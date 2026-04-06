import { v4 as uuidv4 } from "uuid";
import { insertChunk } from "./database";
import { invoke } from "@tauri-apps/api/core";
import type { Chunk } from "../types/database";

interface ChunkOptions {
    chunkSize?: number;
    overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 200;

export function chunkText(
    text: string,
    options: ChunkOptions = {}
): { content: string; index: number }[] {
    const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    const overlap = options.overlap || DEFAULT_OVERLAP;
    const chunks: { content: string; index: number }[] = [];

    let start = 0;
    let index = 0;

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);

        if (end < text.length) {
            const lastPeriod = text.lastIndexOf('.', end);
            const lastNewline = text.lastIndexOf('\n', end);
            const breakPoint = Math.max(lastPeriod, lastNewline);
            if (breakPoint > start) {
                end = breakPoint + 1;
            }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk) {
            chunks.push({ content: chunk, index });
            index++;
        }

        start = end - overlap;
        if (start >= text.length) break;
    }

    return chunks;
}

export async function processAndStoreChunks(
    documentId: string,
    fullText: string,
    pageCount: number
): Promise<void> {
    const chunks = chunkText(fullText, { chunkSize: 1500, overlap: 200 });
    const approxPagesPerChunk = Math.max(1, Math.ceil(pageCount / chunks.length));

    for (let i = 0; i < chunks.length; i++) {
        const embedding = await invoke<number[]>("generate_embedding", { text: chunks[i].content });
        const embeddingBytes = new Uint8Array(new Float32Array(embedding).buffer);

        const chunk: Omit<Chunk, 'created_at'> = {
            id: uuidv4(),
            document_id: documentId,
            chunk_index: chunks[i].index,
            content: chunks[i].content,
            embedding: embeddingBytes,
            page_num: Math.min(Math.floor(i * approxPagesPerChunk) + 1, pageCount),
        };
        await insertChunk(chunk);
    }
}
