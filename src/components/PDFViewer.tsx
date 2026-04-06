import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, IconButton, Typography, CircularProgress, Alert } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// 配置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

interface PDFViewerProps {
    filePath: string;
    onLoadSuccess?: (numPages: number) => void;
}

export function PDFViewer({ filePath, onLoadSuccess }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const onDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
        setNumPages(pages);
        setLoading(false);
        setError(null);
        onLoadSuccess?.(pages);
    };

    const onDocumentLoadError = (err: Error) => {
        console.error('PDF 加载失败：', err);
        setError('无法加载 PDF 文件，请确保文件存在且格式正确');
        setLoading(false);
    };

    const goToPrevPage = () => setPageNumber(prev => Math.max(1, prev - 1));
    const goToNextPage = () => setPageNumber(prev => Math.min(numPages || 1, prev + 1));

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 工具栏 */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2,
                p: 1,
                borderBottom: 1,
                borderColor: 'divider'
            }}>
                <IconButton onClick={goToPrevPage} disabled={pageNumber <= 1}>
                    <NavigateBeforeIcon />
                </IconButton>
                <Typography>
                    第 {pageNumber} 页 / 共 {numPages || '?'} 页
                </Typography>
                <IconButton onClick={goToNextPage} disabled={pageNumber >= (numPages || 1)}>
                    <NavigateNextIcon />
                </IconButton>
            </Box>

            {/* PDF 渲染区域 */}
            <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', p: 2 }}>
                {loading && <CircularProgress />}
                {error && <Alert severity="error">{error}</Alert>}
                {!error && (
                    <Document
                        file={filePath}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={<CircularProgress />}
                    >
                        <Page
                            pageNumber={pageNumber}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            scale={1.2}
                        />
                    </Document>
                )}
            </Box>
        </Box>
    );
}