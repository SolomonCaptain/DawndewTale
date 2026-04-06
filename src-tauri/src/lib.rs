use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

mod commands;
use commands::pdf::{parse_pdf, extract_text_only};
use commands::embedding::{init_model, get_embedding, get_embeddings, semantic_search};
use commands::model::ModelManager;

// 定义数据库迁移
fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: include_str!("../migrations/20260405153200_initial.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:litepaper.db", get_migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            parse_pdf,
            extract_text_only,
            init_model,
            get_embedding,
            get_embeddings,
            semantic_search
        ])
        .setup(|app| {
            // 在应用启动时初始化模型
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match ModelManager::init(&app_handle).await {
                    Ok(model_manager) => {
                        app_handle.manage(Arc::new(Mutex::new(model_manager)));
                        println!("模型初始化成功");
                    }
                    Err(e) => {
                        eprintln!("模型初始化失败: {}", e);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
