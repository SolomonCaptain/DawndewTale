import { useState } from "react";
import {
    Card,
    CardContent,
    Typography,
    Chip,
    Stack,
    IconButton,
    Box,
    Paper,
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useDocumentStore } from "../store/documentStore";
import { DocumentDetail } from './DocumentDetail';
import type { Document } from '../types/database';

interface DocumentListProps {
    onImport: () => void;
}

export function DocumentList({ }: DocumentListProps) {
    const { documents, removeDocument, setCurrentDocument, currentDocument } = useDocumentStore();
    const [detailOpen, setDetailOpen] = useState(false);

    const handleViewDocument = (doc: Document) => {
        setCurrentDocument(doc);
        setDetailOpen(true);
    };

    const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('确定要删除这篇文献吗？')) {
            await removeDocument(id);
        }
    };

    if (documents.length === 0) {
        return (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                    暂无文献，点击右下角的 + 按钮导入 PDF 文件
                </Typography>
            </Paper>
        );
    }

    return (
        <>
            <Stack spacing={2}>
                {documents.map((doc) => (
                    <Card key={doc.id} variant="outlined" sx={{ cursor: 'pointer' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box sx={{ flex: 1 }} onClick={() => handleViewDocument(doc)}>
                                    <Typography variant="h6" gutterBottom>
                                        {doc.title}
                                    </Typography>
                                    {doc.authors.length > 0 && (
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            作者：{doc.authors.join(', ')}
                                        </Typography>
                                    )}
                                    {doc.abstract && (
                                        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                            {doc.abstract.length > 200 ? `${doc.abstract.slice(0, 200)}...` : doc.abstract}
                                        </Typography>
                                    )}
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                                        {doc.keywords.slice(0, 5).map((kw) => (
                                            <Chip key={kw} label={kw} size="small" variant="outlined" />
                                        ))}
                                        <Chip label={`${doc.page_count} 页`} size="small" variant="outlined" />
                                    </Box>
                                </Box>
                                <Box>
                                    <IconButton size="small" onClick={() => handleViewDocument(doc)}>
                                        <VisibilityIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" onClick={(e) => handleDeleteDocument(doc.id, e)}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </Stack>

            <DocumentDetail
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                document={currentDocument}
            />
        </>
    );
}