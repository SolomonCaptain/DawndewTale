export interface PdfMetadata {
    title: string;
    authors: string[];
    abstract: string;
    keywords: string[];
}

export interface PdfParsedData {
    metadata: PdfMetadata;
    full_text: string;
    page_count: number;
}

export interface DocumentCreateInput {
    title: string;
    authors: string[];
    abstract: string;
    keywords: string[];
    file_path: string;
    file_name: string;
    file_size: number;
    page_count: number;
}