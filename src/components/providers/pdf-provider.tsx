"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Effect, Layer } from "effect";
import { DocumentStorage, type StoredDocument, type DocumentMetadata, DocumentNotFoundError, StorageError } from "@/lib/storage";
import { PdfParser, MarkdownConverter, PdfServicesLayer, PdfParseError } from "@/lib/pdf-services";
import { getLastPage, saveLastPageDebounced, flushLastPage, removeLastPage } from "@/lib/last-page-storage";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import type { PagesPerView } from "@/components/pdf-viewer";

// ============================================================================
// Types
// ============================================================================

interface PdfContextState {
    documents: typeof DocumentMetadata.Type[];
    currentDocument: typeof StoredDocument.Type | null;
    currentPdf: PDFDocumentProxy | null;
    currentPage: number;
    totalPages: number;
    pagesPerView: PagesPerView;
    isLoading: boolean;
    error: string | null;
}

interface PdfContextActions {
    uploadDocument: (file: File) => Promise<void>;
    openDocument: (id: string) => Promise<void>;
    closeDocument: () => void;
    deleteDocument: (id: string) => Promise<void>;
    goToPage: (page: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    setPagesPerView: (count: PagesPerView) => void;
    copyPageAsMarkdown: () => Promise<string>;
    copyDocumentAsMarkdown: () => Promise<string>;
    refreshDocuments: () => Promise<void>;
}

type PdfContextValue = PdfContextState & PdfContextActions;

// ============================================================================
// Context
// ============================================================================

const PdfContext = createContext<PdfContextValue | null>(null);

export function usePdf() {
    const context = useContext(PdfContext);
    if (!context) {
        throw new Error("usePdf must be used within a PdfProvider");
    }
    return context;
}

// ============================================================================
// Layer composition
// ============================================================================

const AppLayer = Layer.mergeAll(DocumentStorage.layer, PdfServicesLayer);

// Helper to run effects
function runEffect<A, E>(effect: Effect.Effect<A, E, DocumentStorage | PdfParser | MarkdownConverter>) {
    return Effect.runPromise(Effect.provide(effect, AppLayer));
}

// ============================================================================
// Provider
// ============================================================================

export function PdfProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<PdfContextState>({
        documents: [],
        currentDocument: null,
        currentPdf: null,
        currentPage: 1,
        totalPages: 0,
        pagesPerView: 1,
        isLoading: false,
        error: null,
    });

    // Refs to always have latest values for cleanup/beforeunload
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const setLoading = (isLoading: boolean) => setState((s) => ({ ...s, isLoading }));
    const setError = (error: string | null) => setState((s) => ({ ...s, error, isLoading: false }));

    // Load documents on mount
    const refreshDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const docs = await runEffect(
                Effect.gen(function* () {
                    const storage = yield* DocumentStorage;
                    return yield* storage.list();
                })
            );
            setState((s) => ({ ...s, documents: docs, isLoading: false }));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load documents");
        }
    }, []);

    useEffect(() => {
        refreshDocuments();
    }, [refreshDocuments]);

    // Flush last page on tab close/refresh/hide
    useEffect(() => {
        const handleBeforeUnload = () => {
            const { currentDocument, currentPage } = stateRef.current;
            if (currentDocument) {
                console.log("[PDF Provider] beforeunload: flushing page", currentPage, "for doc", currentDocument.id);
                flushLastPage(currentDocument.id, currentPage);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                const { currentDocument, currentPage } = stateRef.current;
                if (currentDocument) {
                    console.log("[PDF Provider] visibilitychange (hidden): flushing page", currentPage, "for doc", currentDocument.id);
                    flushLastPage(currentDocument.id, currentPage);
                }
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    // Upload document
    const uploadDocument = useCallback(async (file: File) => {
        setLoading(true);
        console.log("[PDF Provider] Starting upload for:", file.name);
        try {
            const arrayBuffer = await file.arrayBuffer();
            // Create TWO copies: one for pdf.js (which will detach it) and one for storage
            const dataForParsing = new Uint8Array(arrayBuffer.slice(0));
            const dataForStorage = new Uint8Array(arrayBuffer.slice(0));
            console.log("[PDF Provider] File read, size:", dataForStorage.length, "bytes");

            await runEffect(
                Effect.gen(function* () {
                    const storage = yield* DocumentStorage;
                    const parser = yield* PdfParser;

                    console.log("[PDF Provider] Parsing PDF...");
                    // Parse to get page count (this will detach dataForParsing's buffer)
                    const pdf = yield* parser.parse(dataForParsing);
                    const pageCount = yield* parser.getPageCount(pdf);
                    console.log("[PDF Provider] PDF parsed, pages:", pageCount);

                    // Use the separate copy for storage
                    const doc: typeof StoredDocument.Type = {
                        id: crypto.randomUUID(),
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        type: "pdf",
                        data: dataForStorage,
                        createdAt: new Date(),
                        lastOpenedAt: new Date(),
                        currentPage: 1,
                        totalPages: pageCount,
                    };

                    console.log("[PDF Provider] Saving to storage...");
                    yield* storage.save(doc);
                    console.log("[PDF Provider] Document saved successfully");
                })
            );

            console.log("[PDF Provider] Refreshing documents list...");
            await refreshDocuments();
            console.log("[PDF Provider] Upload complete");
        } catch (e) {
            console.error("[PDF Provider] Upload failed:", e);
            setError(e instanceof Error ? e.message : "Failed to upload document");
        }
    }, [refreshDocuments]);

    // Open document
    const openDocument = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const result = await runEffect(
                Effect.gen(function* () {
                    const storage = yield* DocumentStorage;
                    const parser = yield* PdfParser;

                    const doc = yield* storage.get(id);
                    const pdf = yield* parser.parse(doc.data);

                    // Get the last page from localStorage (fast, lightweight)
                    const lastPage = getLastPage(id);
                    console.log("[PDF Provider] openDocument: getLastPage returned", lastPage, "for doc", id);
                    // Clamp to valid range
                    const validPage = Math.min(Math.max(lastPage, 1), doc.totalPages);
                    console.log("[PDF Provider] openDocument: will start at page", validPage);

                    yield* storage.updateLastOpened(id, validPage);

                    return { doc, pdf, startPage: validPage };
                })
            );

            setState((s) => ({
                ...s,
                currentDocument: result.doc,
                currentPdf: result.pdf,
                currentPage: result.startPage,
                totalPages: result.doc.totalPages,
                isLoading: false,
            }));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to open document");
        }
    }, []);

    // Close document
    const closeDocument = useCallback(() => {
        // Use ref to get the LATEST values (avoid stale closure)
        const { currentDocument, currentPage } = stateRef.current;
        // Flush the current page to localStorage before closing
        if (currentDocument) {
            console.log("[PDF Provider] closeDocument: flushing page", currentPage, "for doc", currentDocument.id);
            flushLastPage(currentDocument.id, currentPage);
        }

        setState((s) => ({
            ...s,
            currentDocument: null,
            currentPdf: null,
            currentPage: 1,
            totalPages: 0,
        }));
    }, []); // No deps needed - we use stateRef for latest values

    // Delete document
    const deleteDocument = useCallback(async (id: string) => {
        setLoading(true);
        try {
            await runEffect(
                Effect.gen(function* () {
                    const storage = yield* DocumentStorage;
                    yield* storage.delete(id);
                })
            );

            // Remove the last page entry from localStorage
            removeLastPage(id);

            if (state.currentDocument?.id === id) {
                closeDocument();
            }

            await refreshDocuments();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete document");
        }
    }, [state.currentDocument?.id, closeDocument, refreshDocuments]);

    // Navigation
    const goToPage = useCallback((page: number) => {
        if (!state.currentDocument || !state.currentPdf) return;
        if (page < 1 || page > state.totalPages) return;

        const documentId = state.currentDocument.id;

        // Update UI immediately
        setState((s) => ({ ...s, currentPage: page }));

        // Save to localStorage with debouncing (fast, doesn't block)
        // This is the ONLY write we do on scroll - no IndexedDB!
        console.log("[PDF Provider] goToPage: saving page", page, "for doc", documentId);
        saveLastPageDebounced(documentId, page);
    }, [state.currentDocument, state.currentPdf, state.totalPages]);

    const nextPage = useCallback(() => {
        goToPage(state.currentPage + 1);
    }, [goToPage, state.currentPage]);

    const prevPage = useCallback(() => {
        goToPage(state.currentPage - 1);
    }, [goToPage, state.currentPage]);

    // Set pages per view
    const setPagesPerView = useCallback((count: PagesPerView) => {
        setState((s) => ({ ...s, pagesPerView: count }));
    }, []);

    // Markdown extraction
    const copyPageAsMarkdown = useCallback(async () => {
        if (!state.currentPdf) {
            throw new Error("No document open");
        }

        const markdown = await runEffect(
            Effect.gen(function* () {
                const parser = yield* PdfParser;
                const converter = yield* MarkdownConverter;

                const text = yield* parser.getPageText(state.currentPdf!, state.currentPage);
                const md = yield* converter.pageToMarkdown(text, state.currentPage);

                return md;
            })
        );

        await navigator.clipboard.writeText(markdown);
        return markdown;
    }, [state.currentPdf, state.currentPage]);

    const copyDocumentAsMarkdown = useCallback(async () => {
        if (!state.currentPdf) {
            throw new Error("No document open");
        }

        const markdown = await runEffect(
            Effect.gen(function* () {
                const parser = yield* PdfParser;
                const converter = yield* MarkdownConverter;

                const content = yield* parser.getAllText(state.currentPdf!);
                const md = yield* converter.documentToMarkdown(content);

                return md;
            })
        );

        await navigator.clipboard.writeText(markdown);
        return markdown;
    }, [state.currentPdf]);

    const value: PdfContextValue = {
        ...state,
        uploadDocument,
        openDocument,
        closeDocument,
        deleteDocument,
        goToPage,
        nextPage,
        prevPage,
        setPagesPerView,
        copyPageAsMarkdown,
        copyDocumentAsMarkdown,
        refreshDocuments,
    };

    return <PdfContext.Provider value={value}>{children}</PdfContext.Provider>;
}
