import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import type { PdfParsedData } from "../types/tauri";

export async function selectPDFFile(): Promise<string | null> {
    const selected = await open({
        multiple: false,
        filters: [{ name: 'PDF 文档', extensions: ['pdf'] }]
    });
    if (selected && typeof selected === 'string') {
        return selected;
    }
    return null;
}

export async function parsePDF(filePath: string): Promise<PdfParsedData> {
    try {
        const result = await invoke<PdfParsedData>('parse_pdf', { filePath });
        return result;
    } catch (error) {
        console.error('PDF 解析错误:', error);
        throw new Error(`PDF 解析失败：${error}`);
    }
}

export async function extractPDFText(filePath: string): Promise<string> {
    try {
        const text = await invoke<string>('extract_text_only', { filePath });
        return text;
    } catch (error) {
        console.error('PDF 文本提取错误:', error);
        throw new Error(`PDF 文本提取失败：${error}`);
    }
}

export async function getFileInfo(filePath: string): Promise<{ name: string; size: number }> {
    const parts = filePath.split(/[/\\]/);
    return {
        name: parts[parts.length - 1],
        size: (await readFile(filePath)).byteLength
    };
}