import Database from '@tauri-apps/plugin-sql';
import type { Document, Chunk } from '../types/database';

let dbInstance: Database | null = null;

export async function initDatabase(): Promise<Database> {
    if (dbInstance) return dbInstance;
    dbInstance = await Database.load('sqlite:litepaper.db');
    return dbInstance; 
}

export async function getDocuments(): Promise<Document[]> {
    const db = await initDatabase();
    const result = await db.select<Array<{
        id: string;
        title: string;
        authors: string;
        abstract: string;
        keywords: string;
        file_path: string;
        file_name: string;
        file_size: number;
        page_count: number;
        publication_date: string | null;
        publisher: string | null;
        doi: string | null;
        created_at: number;
        updated_at: number;
    }>>(
        `SELECT id, title, authors, abstract, keywords, file_path, file_name,
                file_size, page_count, publication_date, publisher, doi, created_at, updated_at
         FROM documents ORDER BY created_at DESC`
    );
    return result.map(doc => ({
        ...doc,
        authors: JSON.parse(doc.authors || '[]'),
        keywords: JSON.parse(doc.keywords || '[]'),
    }));
}

export async function getDocumentById(id: string): Promise<Document | null> {
    const db = await initDatabase();
    const result = await db.select<Array<{
        id: string;
        title: string;
        authors: string;
        abstract: string;
        keywords: string;
        file_path: string;
        file_name: string;
        file_size: number;
        page_count: number;
        publication_date: string | null;
        publisher: string | null;
        doi: string | null;
        created_at: number;
        updated_at: number;
    }>>(
        'SELECT * FROM documents WHERE id = $1',
        [id]
    );
    if (result.length === 0) return null;
    const doc = result[0];
    return {
        ...doc,
        authors: JSON.parse(doc.authors || '[]'),
        keywords: JSON.parse(doc.keywords || '[]'),
    };
}

export async function insertDocument(doc: Omit<Document, 'created_at' | 'updated_at'>): Promise<string> {
    const db = await initDatabase();
    const id = doc.id;
    const now = Date.now();
    await db.execute(
        `INSERT INTO documents (id, title, authors, abstract, keywords, file_path, file_name,
        file_size, page_count, publication_date, publisher, doi, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
            id, doc.title, JSON.stringify(doc.authors), doc.abstract, JSON.stringify(doc.keywords),
            doc.file_path, doc.file_name, doc.file_size, doc.page_count,
            doc.publication_date, doc.publisher, doc.doi, now, now
        ]
    );
    return id;
}

export async function updateDocument(id: string, updates: Partial<Document>): Promise<void> {
    const db = await initDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.title !== undefined) {
        fields.push(`title = $${idx++}`);
        values.push(updates.title);
    }
    if (updates.authors !== undefined) {
        fields.push(`authors = $${idx++}`);
        values.push(JSON.stringify(updates.authors));
    }
    if (updates.abstract !== undefined) {
        fields.push(`abstract = $${idx++}`);
        values.push(updates.abstract);
    }
    if (updates.keywords !== undefined) {
        fields.push(`keywords = $${idx++}`);
        values.push(JSON.stringify(updates.keywords));
    }

    fields.push(`updated_at = $${idx++}`);
    values.push(Date.now());
    values.push(id);

    await db.execute(`UPDATE documents SET ${fields.join(', ')} WHERE id = $${idx}`, values);
}

export async function deleteDocument(id: string): Promise<void> {
    const db = await initDatabase();
    await db.execute('DELETE FROM documents WHERE id = $1', [id]);
}

export async function insertChunk(chunk: Omit<Chunk, 'created_at'>): Promise<void> {
    const db = await initDatabase();

    let embeddingBlob: Uint8Array | null = null;
    if (chunk.embedding) {
        embeddingBlob = float32ArrayToBincode(chunk.embedding);
    }

    await db.execute(
        `INSERT INTO chunks (id, document_id, chunk_index, content, embedding, page_num, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [chunk.id, chunk.document_id, chunk.chunk_index, chunk.content, embeddingBlob, chunk.page_num, Date.now()]
    );
}

function float32ArrayToBincode(floats: Uint8Array): Uint8Array {
    const floatArray = new Float32Array(floats.buffer);
    const length = floatArray.length;

    const buffer = new ArrayBuffer(4 + length * 4);
    const view = new DataView(buffer);

    view.setUint32(0, length, true);

    for (let i = 0; i < length; i++) {
        view.setFloat32(4 + i * 4, floatArray[i], true);
    }

    return new Uint8Array(buffer);
}

export async function getChunksByDocumentId(documentId: string): Promise<Chunk[]> {
    const db = await initDatabase();
    const rawChunks = await db.select<Array<{
        id: string;
        document_id: string;
        chunk_index: number;
        content: string;
        embedding: Uint8Array | null;
        page_num: number;
        created_at: number;
    }>>(
        'SELECT * FROM chunks WHERE document_id = $1 ORDER BY chunk_index',
        [documentId]
    );

    return rawChunks.map(chunk => ({
        ...chunk,
        embedding: chunk.embedding ? bincodeToFloat32Array(chunk.embedding) : null
    }));
}

function bincodeToFloat32Array(blob: Uint8Array): Uint8Array {
    const view = new DataView(blob.buffer);
    const length = view.getUint32(0, true);
    const floatArray = new Float32Array(length);

    for (let i = 0; i < length; i++) {
        floatArray[i] = view.getFloat32(4 + i * 4, true);
    }

    return new Uint8Array(floatArray.buffer);
}