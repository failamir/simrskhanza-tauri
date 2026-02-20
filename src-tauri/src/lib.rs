mod db;
use std::sync::Mutex;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(db::DbState { pool: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![greet, db::test_connection, db::init_connection, db::check_login, db::get_patients, db::count_patients])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
