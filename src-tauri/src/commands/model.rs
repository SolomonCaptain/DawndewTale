use anyhow::{Context, Result};
use fastembed::{InitOptionsUserDefined, TextEmbedding, TokenizerFiles, UserDefinedEmbeddingModel, QuantizationMode};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri::path::BaseDirectory;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ModelError {
    #[error("模型未初始化，请先调用初始化命令")]
    NotInitialized,
    #[error("模型目录不存在: {0}")]
    ModelDirNotFound(String),
    #[error("模型文件复制失败: {0}")]
    CopyFailed(String),
    #[error("FastEmbed 加载失败: {0}")]
    FastEmbedLoadFailed(String),
    #[error("模型加载失败: {0}")]
    ModelLoadFailed(String),
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

// 将自定义错误类型转换为 Tauri 命令可返回的格式
impl serde::Serialize for ModelError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

// 模型管理器，用于管理模型的生命周期
pub struct ModelManager {
    embedder: Arc<Mutex<TextEmbedding>>,
    model_dir: PathBuf,
}

impl ModelManager {
    // 异步初始化模型管理器
    pub async fn init(app_handle: &AppHandle) -> Result<Self, ModelError> {
        let model_dir = Self::get_model_cache_dir(app_handle).await?;

        // 检查模型是否已安装
        if !Self::is_model_installed(&model_dir) {
            // 如果未安装，则从打包资源中复制模型文件
            Self::install_model(app_handle, &model_dir).await?;
        }

        // 加载模型
        let embedder = Self::load_embedder(&model_dir).await?;

        Ok(ModelManager {
            embedder: Arc::new(Mutex::new(embedder)),
            model_dir,
        })
    }

    // 获取模型缓存目录路径
    async fn get_model_cache_dir(app_handle: &AppHandle) -> Result<PathBuf, ModelError> {
        let cache_dir = app_handle
            .path()
            .cache_dir()
            .context("无法获取缓存目录")?;
        // 在缓存目录下创建一个专属的模型文件夹
        Ok(cache_dir.join("com.dawndewtale.models").join("bge-small"))
    }

    // 检查模型是否已安装（通过检查关键文件是否存在）
    fn is_model_installed(model_dir: &Path) -> bool {
        // 检查必要的模型文件和配置文件
        let required_files = [
            "onnx/model.onnx",
            "config.json",
            "tokenizer.json",
        ];
        required_files.iter().all(|f| model_dir.join(f).exists())
    }

    // 从打包资源安装模型到缓存目录
    async fn install_model(app_handle: &AppHandle, target_dir: &Path) -> Result<(), ModelError> {
        fs::create_dir_all(target_dir)?;

        let files_to_copy = [
            "onnx/model.onnx",
            "onnx/model.onnx_data",
            "config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
            "vocab.txt",
        ];

        for file_name in files_to_copy.iter() {
            let source_path = format!("assets/models/bge-small/{}", file_name);
            let target_path = target_dir.join(file_name);

            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }

            // 使用资源目录解析
            let resource_path = app_handle
                .path()
                .resolve(&source_path, BaseDirectory::Resource)
                .map_err(|e| ModelError::ModelDirNotFound(format!("解析资源路径失败: {}", e)))?;

            let bytes = fs::read(&resource_path)
                .map_err(|e| ModelError::ModelDirNotFound(format!("读取资源文件失败: {}", e)))?;

            let mut file = fs::File::create(&target_path)?;
            file.write_all(&bytes)?;
        }

        Ok(())
    }

    // 加载 FastEmbed 模型
    async fn load_embedder(model_dir: &Path) -> Result<TextEmbedding, ModelError> {
        let model_dir = model_dir.to_path_buf();
        let embedder = tokio::task::spawn_blocking(move || {
            let onnx_path = model_dir.join("onnx").join("model.onnx");
            let onnx_bytes = fs::read(&onnx_path)
                .with_context(|| format!("无法读取 ONNX 文件: {:?}", onnx_path))?;

            let onnx_data_path = model_dir.join("onnx").join("model.onnx_data");
        
            let tokenizer_files = TokenizerFiles {
                tokenizer_file: fs::read(model_dir.join("tokenizer.json"))
                    .context("无法读取 tokenizer.json")?,
                config_file: fs::read(model_dir.join("config.json"))
                    .context("无法读取 config.json")?,
                special_tokens_map_file: fs::read(model_dir.join("special_tokens_map.json"))
                    .context("无法读取 special_tokens_map.json")?,
                tokenizer_config_file: fs::read(model_dir.join("tokenizer_config.json"))
                    .context("无法读取 tokenizer_config.json")?,
            };

            let mut user_defined_model = UserDefinedEmbeddingModel::new(onnx_bytes, tokenizer_files);
        
            if onnx_data_path.exists() {
                let data_bytes = fs::read(&onnx_data_path)
                    .with_context(|| format!("无法读取 ONNX 数据文件: {:?}", onnx_data_path))?;
                user_defined_model = user_defined_model
                    .with_external_initializer("model.onnx_data".to_string(), data_bytes);
            }

            // 设置量化模式
            let user_defined_model = user_defined_model
                .with_quantization(QuantizationMode::default());

            TextEmbedding::try_new_from_user_defined(
                user_defined_model,
                InitOptionsUserDefined::default(),
            )
            .map_err(|e| ModelError::FastEmbedLoadFailed(format!("FastEmbed 初始化失败: {}", e)))
        })
        .await
        .map_err(|e| ModelError::ModelLoadFailed(format!("阻塞任务失败: {}", e)))?;

        Ok(embedder?)
    }

    // 生成文本嵌入向量的公共方法
    pub async fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>, ModelError> {
        // 获取锁并在异步上下文中直接调用
        let mut guard = self.embedder.lock().await;
        let embeddings = guard
            .embed(texts, None)
            .map_err(|e| ModelError::ModelLoadFailed(format!("嵌入失败: {}", e)))?;

        Ok(embeddings)
    }
}
