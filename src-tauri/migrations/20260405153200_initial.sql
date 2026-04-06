--- 文献主表
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    authors TEXT,
    abstract TEXT,
    keywords TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    page_count INTEGER,
    publication_date TEXT,
    publisher TEXT,
    doi TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

--- 笔记与标注表
CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    content TEXT NOT NULL,
    color TEXT DEFAULT '#FFEB3B',
    page_num INTEGER,
    rect TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

--- 文献分类/集合表
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE CASCADE
);

--- 文献与分类关联表
CREATE TABLE IF NOT EXISTS document_collections (
    document_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    PRIMARY KEY (document_id, collection_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

--- 文本块表
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB,
    page_num INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

--- 创建索引
CREATE INDEX idx_document_title ON documents(title);
CREATE INDEX idx_document_created_at ON documents(created_at);
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_page_num ON chunks(page_num);