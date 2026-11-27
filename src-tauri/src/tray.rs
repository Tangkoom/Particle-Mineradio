//! 系统托盘与托盘面板。
//!
//! 托盘面板是一个独立的透明 WebView 窗口，右键托盘图标时出现在光标附近，
//! 面板内的按钮通过 Tauri 事件与主窗口里的播放器通信。

use std::sync::atomic::{AtomicU64, Ordering};

use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    WindowEvent,
};

use crate::util::now_ms;
use crate::windows::{toggle_main_window, MAIN_WINDOW};

pub(crate) const TRAY_PANEL: &str = "tray";
const TRAY_ID: &str = "main-tray";
const PANEL_WIDTH: f64 = 380.0;
const PANEL_HEIGHT: f64 = 338.0;

/// 面板失焦的时间戳，用于忽略「点托盘关闭面板」后紧接着的第二次点击。
static LAST_PANEL_BLUR_MS: AtomicU64 = AtomicU64::new(0);

fn note_panel_blur() {
    LAST_PANEL_BLUR_MS.store(now_ms(), Ordering::Relaxed);
}

pub(crate) fn hide_tray_panel(app: &AppHandle) {
    if let Some(panel) = app.get_webview_window(TRAY_PANEL) {
        let _ = panel.hide();
    }
}

fn ensure_tray_panel(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(panel) = app.get_webview_window(TRAY_PANEL) {
        return Some(panel);
    }

    let panel = match WebviewWindowBuilder::new(
        app,
        TRAY_PANEL,
        WebviewUrl::App("index.html#__tray".into()),
    )
    .title("Particle-Mineradio")
    .inner_size(PANEL_WIDTH, PANEL_HEIGHT)
    .resizable(false)
    .decorations(false)
    .shadow(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .focused(false)
    .build()
    {
        Ok(panel) => panel,
        Err(error) => {
            eprintln!("[tray] 创建托盘面板失败: {error}");
            return None;
        }
    };

    let panel_for_event = panel.clone();
    panel.on_window_event(move |event| match event {
        WindowEvent::Focused(false) => {
            note_panel_blur();
            let _ = panel_for_event.hide();
        }
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = panel_for_event.hide();
        }
        _ => {}
    });

    Some(panel)
}

fn show_tray_panel(app: &AppHandle, cursor: PhysicalPosition<f64>) -> tauri::Result<()> {
    let panel = match ensure_tray_panel(app) {
        Some(panel) => panel,
        None => return Ok(()),
    };

    let size = panel.outer_size()?;
    let width = size.width as f64;
    let height = size.height as f64;

    let monitor = app
        .monitor_from_point(cursor.x, cursor.y)?
        .or(app.primary_monitor()?);

    let mut x = cursor.x + 8.0 - width;
    let mut y = cursor.y - height - 8.0;

    if let Some(monitor) = monitor {
        let origin = monitor.position();
        let monitor_size = monitor.size();
        let left = origin.x as f64;
        let top = origin.y as f64;
        let right = left + monitor_size.width as f64;
        let bottom = top + monitor_size.height as f64;

        x = x.max(left + 4.0).min(right - width - 4.0);
        y = y.max(top + 4.0).min(bottom - height - 4.0);
    }

    panel.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))?;
    panel.show()?;
    panel.set_focus()?;
    Ok(())
}

fn toggle_tray_panel(app: &AppHandle, cursor: PhysicalPosition<f64>) {
    if let Some(panel) = app.get_webview_window(TRAY_PANEL) {
        if panel.is_visible().unwrap_or(false) {
            let _ = panel.hide();
            return;
        }
    }

    if now_ms().saturating_sub(LAST_PANEL_BLUR_MS.load(Ordering::Relaxed)) < 250 {
        return;
    }

    if let Err(error) = show_tray_panel(app, cursor) {
        eprintln!("[tray] 显示托盘面板失败: {error}");
    }
}

pub(crate) fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("缺少默认窗口图标，请检查 tauri.conf.json 的 bundle.icon");

    TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Particle-Mineradio")
        .icon(icon)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button,
                button_state,
                position,
                ..
            } = event
            {
                if button_state != MouseButtonState::Up {
                    return;
                }

                let app = tray.app_handle();
                match button {
                    MouseButton::Left => toggle_main_window(app),
                    MouseButton::Right => toggle_tray_panel(app, position),
                    _ => {}
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// 托盘面板底部按钮：显示主界面 / 隐藏主界面 / 退出 / 收起面板。
#[tauri::command]
pub(crate) async fn tray_action(app: AppHandle, action: &str) -> tauri::Result<()> {
    hide_tray_panel(&app);

    match action {
        "show" => crate::windows::show_main_window(&app),
        "hide" => {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                window.hide()?;
            }
        }
        "quit" => app.exit(0),
        _ => {}
    }

    Ok(())
}

/// 主窗口把当前歌曲同步到托盘提示文字。
#[tauri::command]
pub(crate) fn tray_tooltip(app: AppHandle, tooltip: String) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(tooltip));
    }
}
