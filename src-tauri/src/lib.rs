// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 在指定 label 的 webview 窗口中执行 JavaScript。
/// 用于在网易云登录/桥接窗口的同源上下文里发起携带 Cookie 的请求
/// （MUSIC_U 为 HttpOnly，前端 JS 无法读取，只能在其页面上下文中自动携带）。
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, eval_in_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
