//! 主窗口的创建、显示与关闭行为。

use std::sync::atomic::{AtomicU8, Ordering};

use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder, WindowEvent};

pub(crate) const MAIN_WINDOW: &str = "main";

/// 前端设置里的「关闭时动作」：0 = 最小化到托盘，1 = 退出应用。
pub(crate) struct ExitAction(pub AtomicU8);

impl Default for ExitAction {
    fn default() -> Self {
        Self(AtomicU8::new(0))
    }
}

/// 按 tauri.conf.json 里的窗口配置创建主窗口。
///
/// 配置里 `create: false`，这样安装 / 卸载模式下不会加载主界面。
pub(crate) fn create_main_window(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        return Some(window);
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW)?
        .clone();

    let window = match WebviewWindowBuilder::from_config(app, &config)
        .and_then(|builder| builder.build())
    {
        Ok(window) => window,
        Err(error) => {
            eprintln!("[window] 创建主窗口失败: {error}");
            return None;
        }
    };

    let window_for_event = window.clone();
    let app_for_event = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            let action = app_for_event
                .state::<ExitAction>()
                .0
                .load(Ordering::Relaxed);
            if action == 1 {
                app_for_event.exit(0);
            } else {
                api.prevent_close();
                let _ = window_for_event.hide();
            }
        }
    });

    Some(window)
}

pub(crate) fn show_main_window(app: &AppHandle) {
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .or_else(|| create_main_window(app));

    if let Some(window) = window {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub(crate) fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        if window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false) {
            let _ = window.hide();
            return;
        }
    }

    show_main_window(app);
}

/// 前端在启动和修改设置时同步「关闭时动作」，让 Alt+F4 / 任务栏关闭也遵守用户选择。
#[tauri::command]
pub(crate) fn set_exit_action(app: AppHandle, action: u8) {
    app.state::<ExitAction>()
        .0
        .store(action.min(1), Ordering::Relaxed);
}
