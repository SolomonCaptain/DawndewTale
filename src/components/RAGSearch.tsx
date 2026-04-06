import { useState } from "react";
import {
    Box,
    TextField,
    Button,
    CircularProgress,
    Card,
    CardContent,
    Typography,
    Chip,
    Stack,
    InputAdornment,
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import { invoke } from "@tauri-apps/api/core";

interface SearchResult {
    chunk_id: string;
    document_id: string;
    content: string;
    score: number;
    page_num: number;
}

export function RAGSearch() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [documentTitles, setDocumentTitles] = useState<Map<string, string>>(new Map());

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        try {
            const searchResults = await invoke<SearchResult[]>('semantic_search', {
                query: query.trim(),
                limit: 5
            });

            setResults(searchResults);

            // 获取文档标题
            const db = await import('../services/database');
            const titles = new Map<string, string>();
            for (const result of searchResults) {
                const doc = await db.getDocumentById(result.document_id);
                if (doc) titles.set(result.document_id, doc.title);
            }
            setDocumentTitles(titles);
        } catch (error) {
            console.error('搜索失败：', error);
        } finally {
            setLoading(false);
        }
    };

    const getRelevanceLabel = (score: number): string => {
        if (score >= 0.7) return '高度相关';
        if (score >= 0.5) return '相关';
        return '不相关';
    };

    const getRelevanceColor = (score: number): 'success' | 'warning' | 'default' => {
        if (score >= 0.7) return 'success';
        if (score >= 0.5) return 'warning';
        return 'default';
    };

    return (
        <Box sx={{ p: 2 }}>
            <TextField
                fullWidth
                variant="outlined"
                placeholder="输入问题或关键词进行语义搜索..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <Button
                                variant="contained"
                                onClick={handleSearch}
                                disabled={loading || !query.trim()}
                                startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
                            >
                                搜索
                            </Button>
                        </InputAdornment>
                    ),
                }}
                sx={{ mb: 2 }}
            />

            {results.length > 0 && (
                <Stack spacing={2}>
                    <Typography variant="subtitle2" color="text.secondary">
                        找到 {results.length} 条相关结果
                    </Typography>

                    {results.map((result, idx) => (
                        <Card key={idx} variant="outlined">
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        {documentTitles.get(result.document_id) || '未知文献'}
                                    </Typography>
                                    <Chip
                                        label={getRelevanceLabel(result.score)}
                                        color={getRelevanceColor(result.score)}
                                        size="small"
                                    />
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                    第 {result.page_num} 页 - 相似度：{(result.score * 100).toFixed(2)}%
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                                    {result.content.length > 300
                                        ? `${result.content.slice(0, 300)}...`
                                        : result.content}
                                </Typography>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            )}
        </Box>
    );
}