export interface Document {
    id: string;
    title: string;
    authors: string[];
    abstract: string;
    keywords: string[];
    file_path: string;
    file_name: string;
    file_size: number;
    page_count: number;
    publication_date: string | null;
    publisher: string | null;
    doi: string | null;
    created_at: number;
    updated_at: number;
}

export interface Annotation {
    id: string;
    document_id: string;
    content: string;
    color: string;
    page_num: number;
    rect: { x: number, y: number, width: number, height: number } | null;
    created_at: number;
    updated_at: number;
}

export interface Collection {
    id: string;
    name: string;
    parent_id: string | null;
    created_at: number;
    children?: Collection[];
}

export interface Chunk {
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    embedding: Uint8Array | null;
    page_num: number;
    created_at: number;
}

// 数据库操作结果
export interface QueryResult<T> {
    data: T | null;
    error: string | null;
}