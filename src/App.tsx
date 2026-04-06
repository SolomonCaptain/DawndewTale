import { useState, useEffect } from "react";
import {
    AppBar,
    Toolbar,
    Typography,
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    Container,
    Fab,
} from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from '@mui/icons-material/Add';
import { PDFImportDialog } from "./components/PDFImportDialog";
import { DocumentList } from "./components/DocumentList";
import { RAGSearch } from "./components/RAGSearch";
import { useDocumentStore } from "./store/documentStore";

const drawerWidth = 280;

function App() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [currentView, setCurrentView] = useState<'library' | 'search'>('library');
    const {loadDocuments} = useDocumentStore();

    useEffect(() => {
        loadDocuments();
    }, []);

    const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

    const drawer = (
        <Box>
            <Toolbar>
                <Typography variant="h6" noWrap component="div">
                    文献管理助手
                </Typography>
            </Toolbar>
            <List>
                <ListItem disablePadding>
                    <ListItemButton selected={currentView === 'library'} onClick={() => setCurrentView('library')}>
                        <ListItemIcon><LibraryBooksIcon/></ListItemIcon>
                        <ListItemText primary="我的文献库"/>
                    </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                    <ListItemButton selected={currentView === 'search'} onClick={() => setCurrentView('search')}>
                        <ListItemIcon><SearchIcon/></ListItemIcon>
                        <ListItemText primary="知识检索"/>
                    </ListItemButton>
                </ListItem>
            </List>
        </Box>
    );

    return (
        <Box sx={{display: 'flex'}}>
            <AppBar position="fixed" sx={{zIndex: (theme) => theme.zIndex.drawer + 1}}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{mr: 2, display: {sm: 'none'}}}
                    >
                        <MenuIcon/>
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{flexGrow: 1}}>
                        {currentView === 'library' ? '我的文献库' : '知识检索'}
                    </Typography>
                </Toolbar>
            </AppBar>

            <Box component="nav" sx={{width: {sm: drawerWidth}, flexShrink: {sm: 0}}}>
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{keepMounted: true}}
                    sx={{display: {xs: 'block', sm: 'none'}}}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{display: {xs: 'none', sm: 'block'}}}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            <Box component="main" sx={{flexGrow: 1, p: 3, width: {sm: `calc(100% - ${drawerWidth}px)`}}}>
                <Toolbar/>
                <Container maxWidth="lg">
                    {currentView === 'library' && <DocumentList onImport={() => setImportDialogOpen(true)}/>}
                    {currentView === 'search' && <RAGSearch/>}
                </Container>
            </Box>

            {currentView === 'library' && (
                <Fab
                    color="primary"
                    sx={{position: 'fixed', bottom: 16, right: 16}}
                    onClick={() => setImportDialogOpen(true)}
                >
                    <AddIcon/>
                </Fab>
            )}

            <PDFImportDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)}/>
        </Box>
    );
}

export default App;