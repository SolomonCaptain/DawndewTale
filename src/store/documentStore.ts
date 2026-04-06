import { create } from 'zustand';
import { persist } from "zustand/middleware";
import type { Document, Annotation, Collection } from "../types/database";
import { getDocuments, insertDocument, deleteDocument, updateDocument } from "../services/database";

interface DocumentStore {
    documents: Document[];
    currentDocument: Document | null;
    annotations: Annotation[];
    collections: Collection[];
    isLoading: boolean;
    error: string | null;

    // Actions
    loadDocuments: () => Promise<void>;
    addDocument: (doc: Omit<Document, 'created_at' | 'updated_at'>) => Promise<string>;
    updateDocument: (id: string, updates: Partial<Document>) => Promise<void>;
    removeDocument: (id: string) => Promise<void>;
    setCurrentDocument: (doc: Document | null) => void;
    setError: (error: string | null) => void;
}

export const useDocumentStore = create<DocumentStore>()(
    persist(
        (set, get) => ({
            documents: [],
            currentDocument: null,
            annotations: [],
            collections: [],
            isLoading: false,
            error: null,

            loadDocuments: async () => {
                set({ isLoading: true, error: null });
                try {
                    const docs = await getDocuments();
                    set({ documents: docs, isLoading: false });
                } catch (error) {
                    set({ error: String(error), isLoading: false });
                }
            },

            addDocument: async (doc) => {
                set({ isLoading: true, error: null });
                try {
                    const id = await insertDocument(doc);
                    await get().loadDocuments();
                    return id;
                } catch (error) {
                    set({ error: String(error), isLoading: false });
                    throw error;
                }
            },

            updateDocument: async (id, updates) => {
                set({ isLoading: true, error: null });
                try {
                    await updateDocument(id, updates);
                    await get().loadDocuments();
                } catch (error) {
                    set({ error: String(error), isLoading: false });
                    throw error;
                }
            },

            removeDocument: async (id) => {
                set({ isLoading: true, error: null });
                try {
                    await deleteDocument(id);
                    await get().loadDocuments();
                } catch (error) {
                    set({ error: String(error), isLoading: false });
                    throw error;
                }
            },

            setCurrentDocument: (doc) => set({ currentDocument: doc }),

            setError: (error) => set({ error: error }),
        }),
        {
            name: 'document-store',
            partialize: (store) => ({ collections: store.collections }),
        }
    )
);