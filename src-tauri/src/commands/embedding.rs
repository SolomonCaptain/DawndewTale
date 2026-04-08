use crate::commands::model::ModelManager;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

/// 嵌入向量搜索结果
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub chunk_id: String,
    pub document_id: String,
    pub content: String,
    pub page_num: u32,
    pub similarity: f32,
}

/// 将 blob 转换为 Vec<f32>
fn blob_to_vec_f32(blob: &[u8]) -> Result<Vec<f32>> {
    if blob.len() % 4 != 0 {
        anyhow::bail!("嵌入向量数据长度无效");
    }
    let len = blob.len() / 4;
    let mut result = Vec::with_capacity(len);
    for i in 0..len {
        let bytes: [u8; 4] = blob[i * 4..(i + 1) * 4].try_into()?;
        result.push(f32::from_le_bytes(bytes));
    }
    Ok(result)
}

/// 计算余弦相似度
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

/// 初始化模型管理器
#[tauri::command]
pub async fn init_model(app_handle: AppHandle) -> Result<(), String> {
    let model_manager = ModelManager::init(&app_handle)
        .await
        .map_err(|e| e.to_string())?;
    
    // 将模型管理器存储到 Tauri 状态中
    app_handle.manage(Arc::new(Mutex::new(model_manager)));
    
    Ok(())
}

/// 生成文本嵌入向量
#[tauri::command]
pub async fn get_embedding(
    app_handle: AppHandle,
    text: String,
) -> Result<Vec<f32>, String> {
    let state = app_handle
        .try_state::<Arc<Mutex<ModelManager>>>()
        .ok_or("模型未初始化")?;
    
    let manager = state.lock().await;
    manager
        .embed(vec![text])
        .await
        .map(|mut v| v.pop().unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// 批量生成文本嵌入向量
#[tauri::command]
pub async fn get_embeddings(
    app_handle: AppHandle,
    texts: Vec<String>,
) -> Result<Vec<Vec<f32>>, String> {
    let state = app_handle
        .try_state::<Arc<Mutex<ModelManager>>>()
        .ok_or("模型未初始化")?;
    
    let manager = state.lock().await;
    manager.embed(texts).await.map_err(|e| e.to_string())
}

/// 语义搜索 - 根据查询文本搜索相似的文档块
#[tauri::command]
pub async fn semantic_search(
    app_handle: AppHandle,
    query: String,
    limit: usize,
) -> Result<Vec<SearchResult>, String> {
    // 获取模型管理器
    let state = app_handle
        .try_state::<Arc<Mutex<ModelManager>>>()
        .ok_or("模型未初始化")?;
    
    let manager = state.lock().await;
    
    // 生成查询嵌入向量
    let query_embeddings = manager
        .embed(vec![query])
        .await
        .map_err(|e| e.to_string())?;
    let query_embedding = &query_embeddings[0];
    
    // 获取数据库路径
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("litepaper.db");
    let db_url = format!("sqlite:{}?mode=ro", db_path.display());
    
    // 连接数据库（只读模式）
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&db_url)
        .await
        .map_err(|e| format!("数据库连接失败: {}", e))?;
    pool.close().await;
    
    // 查询所有带嵌入向量的文档块
    let chunks: Vec<(String, String, String, Vec<u8>, u32)> = sqlx::query_as(
        "SELECT id, document_id, content, embedding, page_num FROM chunks WHERE embedding IS NOT NULL",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("查询失败: {}", e))?;
    
    // 计算相似度并排序
    let mut results: Vec<SearchResult> = chunks
        .into_iter()
        .filter_map(|(chunk_id, doc_id, content, embedding_blob, page_num)| {
            let embedding = blob_to_vec_f32(&embedding_blob).ok()?;
            let similarity = cosine_similarity(query_embedding, &embedding);
            Some(SearchResult {
                chunk_id,
                document_id: doc_id,
                content,
                page_num,
                similarity,
            })
        })
        .collect();
    
    // 按相似度降序排序并取前 limit 个结果
    results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(limit);
    
    Ok(results)
}
