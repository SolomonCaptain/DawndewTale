import { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Chip,
    Box,
    Stack,
    Divider,
    Tab,
    Tabs, Paper,
} from "@mui/material";
import { PDFViewer } from "./PDFViewer";
import { getChunksByDocumentId } from "../services/database";
import type { Document, Chunk } from "../types/database";

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
    return <div hidden={value !== index}>{value === index && <Box sx={{ p: 2 }}>{children}</Box>}</div>;
}

interface DocumentDetailProps {
    open: boolean;
    onClose: () => void;
    document: Document | null;
}

export function DocumentDetail({ open, onClose, document }: DocumentDetailProps) {
    const [tabValue, setTabValue] = useState(0);
    const [chunks, setChunks] = useState<Chunk[]>([]);

    useEffect(() => {
        if (document && open) {
            getChunksByDocumentId(document.id).then(setChunks);
        }
    }, [document, open]);

    if (!document) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="h6">{document.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            作者：{document.authors.join(", ")}
                        </Typography>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ height: '70vh' }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab label="PDF 阅读器" />
                    <Tab label="摘要与元数据" />
                    <Tab label="文本块" />
                </Tabs>

                <TabPanel index={0} value={tabValue}>
                    <Box sx={{ height: 'calc(70vh - 60px)' }}>
                        <PDFViewer filePath={document.file_path} />
                    </Box>
                </TabPanel>

                <TabPanel index={1} value={tabValue}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle2" color="primary">摘要</Typography>
                            <Typography variant="body2">{document.abstract || '暂无摘要'}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" color="primary">关键词</Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                                {document.keywords.map((kw) => (
                                    <Chip key={kw} label={kw} size="small" />
                                ))}
                            </Box>
                        </Box>
                        <Divider />
                        <Typography variant="caption" color="text.seccondary">
                            页数：{document.page_count} 页<br />
                            导入时间：{new Date(document.created_at).toLocaleString()}
                        </Typography>
                    </Stack>
                </TabPanel>

                <TabPanel index={2} value={tabValue}>
                    <Stack spacing={2} sx={{ maxHeight: 'calc(70vh - 60px', overflow: 'auto' }}>
                        {chunks.map((chunk) => (
                            <Paper key={chunk.id} variant="outlined" sx={{ pp: 2 }}>
                                <Typography variant="caption" color="text.secondary">
                                    第 {chunk.page_num} 页 - 块 {chunk.chunk_index + 1}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    {chunk.content}
                                </Typography>
                            </Paper>
                        ))}
                    </Stack>
                </TabPanel>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>关闭</Button>
            </DialogActions>
        </Dialog>
    );
}