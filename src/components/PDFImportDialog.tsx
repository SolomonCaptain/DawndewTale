import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Chip,
    Stack,
    LinearProgress,
    Alert,
    Box,
    Typography,
} from "@mui/material";
import { v4 as uuidv4 } from 'uuid';
import { useDocumentStore } from "../store/documentStore";
import { selectPDFFile, parsePDF, getFileInfo } from "../services/pdfService";
import { processAndStoreChunks } from "../services/chunkService";
import type { DocumentCreateInput } from "../types/tauri";

interface PDFImportDialogProps {
    open: boolean;
    onClose: () => void;
}

export function PDFImportDialog({ open, onClose }: PDFImportDialogProps) {
    const { addDocument } = useDocumentStore();
    const [step, setStep] = useState<'select' | 'parsing' | 'complete'>('select');
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<DocumentCreateInput | null>(null);
    const [filePath, setFilePath] = useState<string>('');
    const [progress, setProgress] = useState(0);

    const handleSelectFile = async () => {
        setError(null);
        const path = await selectPDFFile();
        if (!path) return;

        setFilePath(path);
        setStep('parsing');
        setProgress(30);

        try {
            const fileInfo = await getFileInfo(path);
            setProgress(50);

            const result = await parsePDF(path);
            setProgress(80);

            setParsedData({
                title: result.metadata.title || fileInfo.name.replace('.pdf', ''),
                authors: result.metadata.authors,
                abstract: result.metadata.abstract,
                keywords: result.metadata.keywords,
                file_path: path,
                file_name: fileInfo.name,
                file_size: fileInfo.size,
                page_count: result.page_count,
            });

            setProgress(100);
            setStep('complete');
        } catch (err) {
            setError(err instanceof Error ? err.message : '解析失败');
            setStep('select')
        }
    };

    const handleConfirm = async () => {
        if (!parsedData) return;

        try {
            const docId = uuidv4();
            await addDocument({
                id: docId, 
                ...parsedData,
                publication_date: null,
                publisher: null,
                doi: null,
            });

            // 分块存储文本
            const fullText = await (await import('../services/pdfService')).extractPDFText(filePath);
            await processAndStoreChunks(docId, fullText, parsedData.page_count);

            onClose();
            setStep('select');
            setParsedData(null);
            setFilePath('');
        } catch (err) {
            setError(err instanceof Error ? err.message : '处理失败');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth={true}>
            <DialogTitle>导入 PDF 文献</DialogTitle>
            <DialogContent>
                {step === 'select' && (
                    <Box sx={{ py: 2 }}>
                        <Button variant="contained" onClick={handleSelectFile} fullWidth={true}>
                            选择 PDF 文件
                        </Button>
                        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                    </Box>
                )}

                {step === 'parsing' && (
                    <Box sx={{ py: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom={true}>
                            正在解析 PDF 文件...
                        </Typography>
                        <LinearProgress variant="determinate" value={progress} sx={{ mt: 2 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            {progress < 30 && '读取文件...'}
                            {progress >= 30 && progress < 50 && '提取元数据...'}
                            {progress >= 50 && progress < 80 && '解析内容...'}
                            {progress >= 80 && '生成预览...'}
                        </Typography>
                    </Box>
                )}

                {step === 'complete' && parsedData && (
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="标题"
                            fullWidth
                            value={parsedData.title}
                            onChange={(e) => setParsedData({ ...parsedData, title: e.target.value })}
                        />
                        <TextField
                            label="作者"
                            fullWidth
                            value={parsedData.authors.join(', ')}
                            onChange={(e) => setParsedData({
                                ...parsedData,
                                authors: e.target.value.split(', ').map(s => s.trim()).filter(Boolean)
                            })}
                            helperText="多个作者请用英文逗号分隔"
                        />
                        <TextField
                            label="摘要"
                            fullWidth
                            multiline
                            rows={4}
                            value={parsedData.abstract}
                            onChange={(e) => setParsedData({ ...parsedData, abstract: e.target.value })}
                        />
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>关键词</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                {parsedData.keywords.map((kw, i) => (
                                    <Chip key={i} label={kw} size="small" />
                                ))}
                            </Stack>
                        </Box>
                        <Alert severity="info">
                            共 {parsedData.page_count} 页，文件大小：{(parsedData.file_size / 1024).toFixed(2)} KB
                        </Alert>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>取消</Button>
                {step === 'complete' && (
                    <Button variant="contained" onClick={handleConfirm}>
                        确认导入
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}