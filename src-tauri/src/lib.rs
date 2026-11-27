// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod installer;
mod tray;
mod util;
mod windows;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 在指定 label 的 webview 窗口中执行 JavaScript。
#[tauri::command]
async fn eval_in_window(
    app: tauri::AppHandle,
    label: String,
    script: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window
            .eval(script)
            .map_err(|error| format!("eval in '{label}' failed: {error}"))
    } else {
        Err(format!("webview window '{label}' not found"))
    }
}

/// 退出应用：销毁所有窗口、托盘并结束进程。
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mode = installer::detect_mode();
    installer::boot(mode);

    tauri::Builder::default()
        .manage(installer::SetupMode(mode))
        .manage(windows::ExitAction::default())
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            if mode.is_setup() {
                // 安装 / 卸载模式：只展示安装界面，不加载主界面。
                installer::show_setup_window(app.handle(), mode);
            } else {
                // 正常模式：按配置创建主窗口，并启用托盘与托盘面板。
                windows::show_main_window(app.handle());
                tray::setup_tray(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            eval_in_window,
            exit_app,
            tray::tray_action,
            tray::tray_tooltip,
            windows::set_exit_action,
            installer::setup_mode,
            installer::suggested_dir,
            installer::install_dir,
            installer::pick_directory,
            installer::install,
            installer::launch_app,
            installer::uninstall,
            installer::quit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
