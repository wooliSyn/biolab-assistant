#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use tauri::{
    Manager, LogicalSize, LogicalPosition, UserAttentionType,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_notification::NotificationExt;

/// 获取应用数据目录
fn get_data_dir() -> PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("biolab-assistant");
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
    }
    dir
}

/// 从本地文件加载数据
#[tauri::command]
fn load_data(key: String) -> Option<String> {
    let path = get_data_dir().join(format!("{}.json", key));
    fs::read_to_string(path).ok()
}

/// 批量加载多个 key（单次 IPC 往返，减少启动时的来回调用开销）
#[tauri::command]
fn load_many(keys: Vec<String>) -> std::collections::HashMap<String, String> {
    let mut out = std::collections::HashMap::new();
    let dir = get_data_dir();
    for k in keys {
        let path = dir.join(format!("{}.json", k));
        if let Ok(v) = fs::read_to_string(path) {
            out.insert(k, v);
        }
    }
    out
}

/// 保存数据到本地文件
#[tauri::command]
fn save_data(key: String, value: String) -> Result<(), String> {
    let path = get_data_dir().join(format!("{}.json", key));
    fs::write(path, value).map_err(|e| e.to_string())
}

/// 数据目录路径（数据管理弹窗展示用）
#[tauri::command]
fn data_dir_path() -> String {
    get_data_dir().to_string_lossy().to_string()
}

/// 清空全部本地数据（勾选「删除原来数据」时调用）
#[tauri::command]
fn clear_all_data() -> Result<u32, String> {
    let dir = get_data_dir();
    let mut removed = 0u32;
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.extension().map(|e| e == "json").unwrap_or(false) {
            if fs::remove_file(&p).is_ok() {
                removed += 1;
            }
        }
    }
    Ok(removed)
}

/// 原生「另存为」对话框保存文本文件（修复 WebView 内 anchor 下载无效的问题）
#[tauri::command]
fn save_text_file(title: String, default_name: String, content: String) -> Result<Option<String>, String> {
    let ext = default_name
        .rsplit('.')
        .next()
        .unwrap_or("txt")
        .to_string();
    let file = rfd::FileDialog::new()
        .set_title(&title)
        .set_file_name(&default_name)
        .add_filter("文本文件", &[&ext, "txt", "md", "json"])
        .add_filter("所有文件", &["*"])
        .save_file();
    match file {
        Some(path) => {
            fs::write(&path, content).map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

/// 保存附件文件到本地 attachments 目录，返回存储路径（供日后用系统查看器打开）
#[tauri::command]
fn save_attachment(name: String, bytes: Vec<u8>) -> Result<String, String> {
    let dir = get_data_dir().join("attachments");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    // 仅保留文件名，防止路径穿越；加时间戳避免覆盖
    let safe_name = std::path::Path::new(&name)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "attachment.bin".to_string());
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = dir.join(format!("{}_{}", ts, safe_name));
    fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// 用系统默认程序打开文件（图片查看器 / 关联应用）
#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 在系统文件管理器中定位并选中源文件（点8：打开到源文件所在位置）
#[tauri::command]
fn reveal_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // 兼容旧版存储的正斜杠路径
        let normalized = path.replace('/', "\\");
        if !std::path::Path::new(&normalized).exists() {
            return Err(format!("文件不存在：{}", normalized));
        }
        // 必须用 /select,"<path>" 单一参数形式；拆成两个参数会因逗号后多出空格导致 explorer 无法定位选中
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", normalized))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").args(["-R", &path]).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let parent = std::path::Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone());
        std::process::Command::new("xdg-open").arg(&parent).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// PowerShell WinRT Toast 回退（插件通知被系统拦截/关闭时兜底）
/// 仅 Windows：macOS / Linux 上根本没有 powershell，留着只会 spawn 失败。
#[cfg(target_os = "windows")]
fn ps_toast(title: &str, body: &str) {
    let esc = |s: &str| s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;");
    let script = format!(
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; \
         [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; \
         [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null; \
         $xml = New-Object Windows.Data.Xml.Dom.XmlDocument; \
         $xml.LoadXml('<toast><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text></binding></visual></toast>'); \
         $tn = [Windows.UI.Notifications.ToastNotification]::new($xml); \
         [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('BioLab 实验助手').Show($tn)",
        esc(title),
        esc(body)
    );
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .spawn();
}

/// 发送系统通知：插件优先，失败回退 PowerShell Toast；同时闪烁任务栏
#[tauri::command]
fn send_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    // 任务栏闪烁，窗口最小化/隐藏时也能引起注意
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.request_user_attention(Some(UserAttentionType::Informational));
    }
    let plugin_ok = app
        .notification()
        .builder()
        .title(title.clone())
        .body(body.clone())
        .show()
        .is_ok();
    #[cfg(target_os = "windows")]
    if !plugin_ok {
        let t = title.clone();
        let b = body.clone();
        std::thread::spawn(move || ps_toast(&t, &b));
    }
    // 非 Windows 平台没有这条兜底路径；通知插件失败就只剩任务栏/Dock 提醒
    #[cfg(not(target_os = "windows"))]
    let _ = plugin_ok;
    Ok(())
}

/// 最小化窗口
#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

/// 关闭窗口（隐藏到托盘）
#[tauri::command]
fn close_window(window: tauri::Window) {
    let _ = window.hide();
}

/// 退出整个程序（关闭确认弹窗中选择「退出」时调用）
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 请求用户注意：恢复并闪烁任务栏按钮（到点提醒防最小化遗漏）
#[tauri::command]
fn request_attention(window: tauri::Window) -> Result<(), String> {
    let _ = window.unminimize();
    let _ = window.show();
    window
        .request_user_attention(Some(UserAttentionType::Informational))
        .map_err(|e| e.to_string())
}

/// 恢复主窗口（托盘点击/菜单共用：取消最小化 + 显示 + 聚焦）
fn restore_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// 切换 mini 窗口模式：缩小并置顶 / 恢复常规尺寸
#[tauri::command]
fn set_mini_mode(window: tauri::Window, mini: bool) -> Result<(), String> {
    if mini {
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
        window.set_size(LogicalSize::new(320.0, 200.0)).map_err(|e| e.to_string())?;
        // 移动到屏幕右上角
        if let Ok(Some(monitor)) = window.current_monitor() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            let x = (size.width as f64 / scale) - 320.0 - 24.0;
            let y = 64.0;
            let _ = window.set_position(LogicalPosition::new(x, y));
        }
    } else {
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_size(LogicalSize::new(1180.0, 740.0)).map_err(|e| e.to_string())?;
        let _ = window.center();
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // 创建托盘菜单
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // 系统托盘：tauri.conf.json 的 app.trayIcon 已由 Tauri 自动创建（id = "main"，
            // 带图标）。这里把菜单和事件挂到它上面，而不是再 new 一个——
            // 再 new 一个会得到第二个「没有图标」的托盘：能看到的点了没反应，有菜单的看不到。
            let tray = match app.tray_by_id("main") {
                Some(t) => t,
                None => {
                    let mut b = TrayIconBuilder::with_id("main");
                    if let Some(icon) = app.default_window_icon() {
                        b = b.icon(icon.clone());
                    }
                    b.build(app)?
                }
            };
            tray.set_menu(Some(menu))?;
            tray.set_show_menu_on_left_click(false)?; // 左键恢复窗口，右键弹菜单
            tray.set_tooltip(Some("BioLab 实验助手"))?;
            tray.on_menu_event(|app, event| match event.id.as_ref() {
                "show" => restore_window(app),
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            });
            tray.on_tray_icon_event(|tray, event| {
                // 左键单击/双击均恢复窗口
                match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                    | TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => {
                        restore_window(tray.app_handle());
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_data,
            load_many,
            save_data,
            data_dir_path,
            clear_all_data,
            save_text_file,
            save_attachment,
            open_file,
            reveal_file,
            send_notification,
            request_attention,
            minimize_window,
            close_window,
            quit_app,
            set_mini_mode,
        ])
        // macOS 用原生红绿灯：点红灯按平台习惯隐藏窗口（计时继续跑），而不是关掉最后一个窗口导致整个程序退出
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (window, event);
        })
        .build(tauri::generate_context!())
        .expect("error while building BioLab Assistant")
        .run(|app, event| {
            // macOS：窗口隐藏后点 Dock 图标要能把它叫回来
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                restore_window(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
