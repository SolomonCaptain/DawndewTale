use serde::{Serialize, Deserialize};
use tauri::command;
use kreuzberg::{extract_bytes, ExtractionConfig};
use anyhow::Result;
use std::fs;


#[derive(Debug, Serialize, Deserialize)]
pub struct PaperMetadata {
    pub title: String,
    pub authors: Vec<String>,
    #[serde(rename = "abstract")]
    pub abstract_: String,
    pub keywords: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PdfParsedData {
    pub metadata: PaperMetadata,
    pub full_text: String,
    pub page_count: u32,
}

#[command]
pub async fn parse_pdf(file_path: String) -> Result<PdfParsedData, String> {
    // 读取 PDF 文件内容
    let bytes = fs::read(&file_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;

    // 配置提取选项
    let config = ExtractionConfig::default();

    // 调用 kreuzberg 解析 PDF
    let extracted = extract_bytes(&bytes, "application/pdf", &config)
        .await
        .map_err(|e| format!("PDF 解析失败: {}", e))?;

    // 获取页数（pages 字段可能为 None）
    let page_count = extracted
        .pages
        .as_ref()
        .map(|pages| pages.len() as u32)
        .unwrap_or(0);

    let metadata = PaperMetadata {
        title: String::new(),
        authors: Vec::new(),
        abstract_: String::new(),
        keywords: Vec::new(),
    };

    Ok(PdfParsedData {
        metadata,
        full_text: extracted.content,
        page_count,
    })
}

#[command]
pub async fn extract_text_only(file_path: String) -> Result<String, String> {
    let bytes = fs::read(&file_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    let config = ExtractionConfig::default();
    let extracted = extract_bytes(&bytes, "application/pdf", &config)
        .await
        .map_err(|e| format!("文本提取失败: {}", e))?;
    Ok(extracted.content)
}