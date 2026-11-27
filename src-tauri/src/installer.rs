//! 自解压安装 / 卸载程序（参考 matrixtech-client-pc 的实现）。
//!
//! 程序启动时根据自身路径、命令行参数和注册表判断当前运行模式：
//! - 已安装目录中的主程序：正常启动应用；
//! - 其他位置（下载目录）双击：展示安装界面；
//! - 安装目录中的 uninstall.exe 或带 `--uninstall`：展示卸载界面。
//!
//! 所有写操作都发生在 HKCU / %LOCALAPPDATA% / 用户桌面与开始菜单，不需要管理员权限。

use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    thread,
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONWARNING, MB_OK};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub(crate) const SETUP_WINDOW: &str = "setup";
const APP_NAME: &str = "Particle-Mineradio";
const APP_EXE: &str = "Particle-Mineradio.exe";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const PUBLISHER: &str = "Particle-Mineradio";
const UNINSTALL_KEY: &str =
    "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\com.tauri-app.Particle-Mineradio";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const CLEANUP_ARG: &str = "--cleanup-after-exit";
const CLEANUP_HELPER: &str = "particle-mineradio-cleanup.exe";
const CHUNK: usize = 128 * 1024;

/// 当前进程应该以哪种身份运行。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Mode {
    App,
    Install,
    Uninstall,
}

impl Mode {
    pub(crate) fn is_setup(self) -> bool {
        matches!(self, Mode::Install | Mode::Uninstall)
    }
}

/// 注入到 Tauri 状态里，供 setup 命令读取。
pub(crate) struct SetupMode(pub Mode);

#[derive(Clone, Serialize)]
struct Progress {
    percent: u32,
    stage: String,
}

static PENDING_CLEANUP: Mutex<Option<PathBuf>> = Mutex::new(None);

fn emit(app: &AppHandle, percent: u32, stage: &str) {
    let _ = app.emit(
        "setup-progress",
        Progress {
            percent,
            stage: stage.to_string(),
        },
    );
}

fn emit_file(app: &AppHandle, path: &Path) {
    let _ = app.emit("setup-file", path.display().to_string());
}

fn local_app_data() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
}

fn default_dir() -> PathBuf {
    local_app_data().join(APP_NAME)
}

fn desktop_dir() -> PathBuf {
    std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|home| home.join("Desktop"))
        .unwrap_or_else(|| local_app_data().join("Desktop"))
}

fn start_menu_dir() -> PathBuf {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|appdata| appdata.join("Microsoft\\Windows\\Start Menu\\Programs"))
        .unwrap_or_else(|| local_app_data().join("Programs"))
}

fn current_exe() -> PathBuf {
    std::env::current_exe().unwrap_or_else(|_| PathBuf::from(APP_EXE))
}

fn installed_dir() -> Option<PathBuf> {
    let key = format!("HKCU\\{UNINSTALL_KEY}");
    let output = Command::new("reg")
        .args(["query", &key, "/v", "InstallLocation"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        if line.contains("InstallLocation") {
            let value = line.split("REG_SZ").nth(1)?.trim();
            if !value.is_empty() {
                return Some(PathBuf::from(value));
            }
        }
    }

    None
}

fn webview2_present() -> bool {
    const GUID: &str = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    const ROOTS: [&str; 3] = [
        "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients",
        "HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients",
        "HKCU\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients",
    ];

    for root in ROOTS {
        let key = format!("{root}\\{GUID}");
        if let Ok(output) = Command::new("reg")
            .args(["query", &key, "/v", "pv"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            if output.status.success() {
                return true;
            }
        }
    }

    false
}

fn native_message(text: &str, title: &str) {
    use windows::core::HSTRING;

    unsafe {
        let _ = MessageBoxW(
            None,
            &HSTRING::from(text),
            &HSTRING::from(title),
            MB_OK | MB_ICONWARNING,
        );
    }
}

/// 根据命令行、exe 名称、安装目录和注册表推断运行模式。
pub(crate) fn detect_mode() -> Mode {
    let args: Vec<String> = std::env::args().collect();

    if args.iter().any(|arg| arg == "--uninstall") {
        return Mode::Uninstall;
    }
    if args.iter().any(|arg| arg == "--setup") {
        return Mode::Install;
    }
    if tauri::is_dev() {
        return Mode::App;
    }

    let me = current_exe();
    let name = me
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if name == "uninstall.exe" {
        return Mode::Uninstall;
    }

    if let Some(dir) = installed_dir() {
        if me == dir.join(APP_EXE) {
            return Mode::App;
        }
    }

    if me.parent() == Some(default_dir().as_path()) {
        return Mode::App;
    }

    Mode::Install
}

/// 在 Tauri 初始化之前执行：清理模式、残留 helper、WebView2 检查。
pub(crate) fn boot(mode: Mode) {
    let args: Vec<String> = std::env::args().collect();
    if let Some(index) = args.iter().position(|arg| arg == CLEANUP_ARG) {
        if let Some(dir) = args.get(index + 1) {
            run_cleanup(Path::new(dir));
        }
        std::process::exit(0);
    }

    sweep_stale_helper();

    if mode.is_setup() && !webview2_present() {
        native_message(
            "缺少 Microsoft Edge WebView2 运行时，安装程序无法启动。\n请先安装 WebView2 后重试：\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703",
            "Particle-Mineradio 安装程序",
        );
        std::process::exit(1);
    }
}

pub(crate) fn show_setup_window(app: &AppHandle, mode: Mode) {
    let window = match app.get_webview_window(SETUP_WINDOW) {
        Some(window) => window,
        None => {
            let title = if mode == Mode::Uninstall {
                "卸载 Particle-Mineradio"
            } else {
                "安装 Particle-Mineradio"
            };

            match WebviewWindowBuilder::new(
                app,
                SETUP_WINDOW,
                WebviewUrl::App("index.html#__setup".into()),
            )
            .title(title)
            .inner_size(640.0, 464.0)
            .resizable(false)
            .decorations(false)
            .shadow(false)
            .transparent(true)
            .center()
            .visible(false)
            .build()
            {
                Ok(window) => window,
                Err(error) => {
                    eprintln!("[setup] 创建设置窗口失败: {error}");
                    return;
                }
            }
        }
    };

    let handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            flush_cleanup();
            handle.exit(0);
        }
    });

    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
pub(crate) fn setup_mode(state: State<'_, SetupMode>) -> String {
    if state.0 == Mode::Uninstall {
        "uninstall".into()
    } else {
        "install".into()
    }
}

#[tauri::command]
pub(crate) fn suggested_dir() -> String {
    default_dir().display().to_string()
}

#[tauri::command]
pub(crate) fn install_dir() -> String {
    current_exe()
        .parent()
        .map(|dir| dir.display().to_string())
        .unwrap_or_default()
}

#[tauri::command]
pub(crate) async fn pick_directory() -> Option<String> {
    tauri::async_runtime::spawn_blocking(|| {
        let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择安装位置'
$dialog.ShowNewFolderButton = $false
if ($dialog.ShowDialog() -eq 'OK') { Write-Output $dialog.SelectedPath }
"#;

        Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
            .filter(|value| !value.is_empty())
    })
    .await
    .ok()
    .flatten()
}

#[tauri::command]
pub(crate) async fn install(app: AppHandle, dir: String) -> Result<(), String> {
    if running_pids()
        .iter()
        .any(|pid| *pid != std::process::id())
    {
        return Err("Particle-Mineradio 正在运行，请先退出后再安装".into());
    }

    tauri::async_runtime::spawn_blocking(move || install_blocking(&app, &dir))
        .await
        .map_err(|error| format!("安装线程异常：{error}"))?
}

#[tauri::command]
pub(crate) fn launch_app(dir: String) -> Result<(), String> {
    let exe = PathBuf::from(dir).join(APP_EXE);
    Command::new(&exe)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("启动程序失败：{error}"))
}

#[tauri::command]
pub(crate) fn quit(app: AppHandle) {
    flush_cleanup();
    app.exit(0);
}

#[tauri::command]
pub(crate) async fn uninstall(app: AppHandle, dir: String) -> Result<(), String> {
    if app_running() {
        return Err("Particle-Mineradio 正在运行，请先退出后再卸载".into());
    }

    tauri::async_runtime::spawn_blocking(move || uninstall_blocking(&app, &dir))
        .await
        .map_err(|error| format!("卸载线程异常：{error}"))?
}

fn install_blocking(app: &AppHandle, dir: &str) -> Result<(), String> {
    if dir.trim().is_empty() {
        return Err("请选择安装位置".into());
    }

    let target_dir = PathBuf::from(dir);
    let me = current_exe();
    let exe_path = target_dir.join(APP_EXE);

    fs::create_dir_all(&target_dir).map_err(|error| format!("创建安装目录失败：{error}"))?;

    emit(app, 2, "正在解包主程序…");
    let total = fs::metadata(&me)
        .map(|metadata| metadata.len())
        .unwrap_or(1)
        .max(1);
    let mut source = fs::File::open(&me).map_err(|error| format!("打开安装包失败：{error}"))?;
    let mut target =
        fs::File::create(&exe_path).map_err(|error| format!("写入主程序失败：{error}"))?;
    let mut buffer = vec![0u8; CHUNK];
    let mut written: u64 = 0;

    loop {
        let read = source
            .read(&mut buffer)
            .map_err(|error| format!("读取安装包失败：{error}"))?;
        if read == 0 {
            break;
        }
        target
            .write_all(&buffer[..read])
            .map_err(|error| format!("写入主程序失败：{error}"))?;
        written += read as u64;
        emit(
            app,
            (2 + written.saturating_mul(86) / total).min(88) as u32,
            "正在解包主程序…",
        );
        thread::sleep(Duration::from_millis(6));
    }

    let _ = target.flush();
    drop(target);

    emit(app, 92, "正在写入卸载程序…");
    let uninstall_path = target_dir.join("uninstall.exe");
    fs::copy(&me, &uninstall_path).map_err(|error| format!("写入卸载程序失败：{error}"))?;

    emit(app, 95, "正在创建快捷方式…");
    let start_menu = start_menu_dir().join(APP_NAME);
    fs::create_dir_all(&start_menu).map_err(|error| format!("创建开始菜单目录失败：{error}"))?;
    create_shortcuts(
        &desktop_dir().join(format!("{APP_NAME}.lnk")),
        &start_menu.join(format!("{APP_NAME}.lnk")),
        &exe_path,
        &target_dir,
    )?;

    emit(app, 98, "正在注册卸载信息…");
    write_reg("DisplayName", APP_NAME)?;
    write_reg("DisplayVersion", APP_VERSION)?;
    write_reg("Publisher", PUBLISHER)?;
    write_reg("DisplayIcon", &exe_path.display().to_string())?;
    write_reg("InstallLocation", &target_dir.display().to_string())?;
    write_reg(
        "UninstallString",
        &format!("\"{}\" --uninstall", uninstall_path.display()),
    )?;
    write_reg("NoModify", "1")?;
    write_reg("NoRepair", "1")?;

    emit(app, 100, "安装完成");
    Ok(())
}

fn uninstall_blocking(app: &AppHandle, dir: &str) -> Result<(), String> {
    let target_dir = PathBuf::from(dir);
    let me = current_exe();

    let desktop = desktop_dir().join(format!("{APP_NAME}.lnk"));
    if desktop.exists() {
        emit_file(app, &desktop);
        let _ = fs::remove_file(&desktop);
        emit(app, 4, "正在删除快捷方式…");
        thread::sleep(Duration::from_millis(120));
    }

    let start_menu = start_menu_dir().join(APP_NAME);
    if start_menu.exists() {
        for file in collect_files(&start_menu) {
            emit_file(app, &file);
            let _ = fs::remove_file(&file);
            thread::sleep(Duration::from_millis(60));
        }

        let mut dirs = collect_dirs(&start_menu);
        dirs.sort();
        dirs.reverse();
        for dir in dirs {
            let _ = fs::remove_dir(&dir);
        }
        let _ = fs::remove_dir(&start_menu);
        emit(app, 8, "正在清理开始菜单…");
    }

    let key = format!("HKCU\\{UNINSTALL_KEY}");
    let _ = Command::new("reg")
        .args(["delete", &key, "/f"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    emit(app, 10, "正在清理注册表…");
    thread::sleep(Duration::from_millis(120));

    let files = collect_files(&target_dir);
    let total = files
        .iter()
        .filter(|path| path.as_path() != me.as_path())
        .count()
        .max(1) as u64;
    let mut done: u64 = 0;

    for file in &files {
        if file == &me {
            continue;
        }
        if fs::remove_file(file).is_ok() {
            emit_file(app, file);
        }
        done += 1;
        emit(
            app,
            (10 + done * 88 / total).min(98) as u32,
            "正在删除程序文件…",
        );
        thread::sleep(Duration::from_millis(45));
    }

    let mut dirs = collect_dirs(&target_dir);
    dirs.sort();
    dirs.reverse();
    for dir in dirs {
        let _ = fs::remove_dir(&dir);
    }

    *PENDING_CLEANUP.lock().unwrap() = Some(target_dir);
    emit(app, 100, "卸载完成");
    Ok(())
}

fn create_shortcuts(
    desktop: &Path,
    start_menu: &Path,
    target: &Path,
    workdir: &Path,
) -> Result<(), String> {
    let desktop = ps_escape(desktop);
    let start_menu = ps_escape(start_menu);
    let target = ps_escape(target);
    let workdir = ps_escape(workdir);

    let script = format!(
        "$w = New-Object -ComObject WScript.Shell\nforeach ($p in @('{desktop}', '{start_menu}')) {{\n  $l = $w.CreateShortcut($p)\n  $l.TargetPath = '{target}'\n  $l.WorkingDirectory = '{workdir}'\n  $l.IconLocation = '{target}'\n  $l.Save()\n}}"
    );

    run_powershell(&script)
}

fn ps_escape(path: &Path) -> String {
    path.display().to_string().replace('\'', "''")
}

fn run_powershell(script: &str) -> Result<(), String> {
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("启动 PowerShell 失败：{error}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err("PowerShell 执行失败".into())
    } else {
        Err(format!("PowerShell 执行失败：{stderr}"))
    }
}

fn write_reg(value: &str, data: &str) -> Result<(), String> {
    let key = format!("HKCU\\{UNINSTALL_KEY}");
    let output = Command::new("reg")
        .args([
            "add", &key, "/v", value, "/t", "REG_SZ", "/d", data, "/f",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("写入注册表失败：{error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "写入注册表失败：{}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn collect_files(root: &Path) -> Vec<PathBuf> {
    let mut result = Vec::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.is_file() {
                result.push(path);
            }
        }
    }

    result.sort();
    result
}

fn collect_dirs(root: &Path) -> Vec<PathBuf> {
    let mut result = Vec::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                result.push(path.clone());
                stack.push(path);
            }
        }
    }

    result
}

fn running_pids() -> Vec<u32> {
    let filter = format!("IMAGENAME eq {APP_EXE}");
    let output = match Command::new("tasklist")
        .args(["/NH", "/FO", "CSV", "/FI", &filter])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        Ok(output) => output,
        Err(_) => return Vec::new(),
    };

    if !output.status.success() {
        return Vec::new();
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let mut parts = line.split("\",\"");
            let _name = parts.next()?;
            parts.next()?.trim_end_matches('"').parse::<u32>().ok()
        })
        .collect()
}

fn app_running() -> bool {
    !running_pids().is_empty()
}

fn schedule_cleanup(dir: PathBuf) {
    let helper = std::env::temp_dir().join(CLEANUP_HELPER);
    let me = current_exe();

    if fs::copy(&me, &helper).is_err() {
        return;
    }

    let _ = Command::new(&helper)
        .arg(CLEANUP_ARG)
        .arg(dir)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

fn run_cleanup(dir: &Path) {
    for _ in 0..1200 {
        if fs::remove_dir_all(dir).is_ok() || !dir.exists() {
            break;
        }
        thread::sleep(Duration::from_millis(300));
    }
}

fn sweep_stale_helper() {
    let helper = std::env::temp_dir().join(CLEANUP_HELPER);
    let _ = fs::remove_file(helper);
}

fn flush_cleanup() {
    if let Some(dir) = PENDING_CLEANUP.lock().unwrap().take() {
        schedule_cleanup(dir);
    }
}
