"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useTheme } from "better-themes";

export type PagesPerView = 1 | 2 | 4;

interface PdfViewerProps {
    pdf: PDFDocumentProxy;
    currentPage: number;
    pagesPerView?: PagesPerView;
    onPageChange?: (page: number) => void;
}

export function PdfViewer({ pdf, currentPage, pagesPerView = 1, onPageChange }: PdfViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
    const renderTasksRef = useRef<Map<number, RenderTask>>(new Map());
    const observerRef = useRef<IntersectionObserver | null>(null);
    const [scale, setScale] = useState(1.5);
    const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
    const [visiblePage, setVisiblePage] = useState(currentPage);
    const isScrollingRef = useRef(false);
    const { theme } = useTheme();

    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    // Generate all page numbers
    const allPages = Array.from({ length: pdf.numPages }, (_, i) => i + 1);

    // Render a single page
    const renderPage = useCallback(async (pageNum: number) => {
        const canvas = canvasRefs.current.get(pageNum);
        if (!canvas) return;

        // Skip if already rendered at current scale
        if (renderedPages.has(pageNum)) return;

        const existingTask = renderTasksRef.current.get(pageNum);
        if (existingTask) {
            try {
                existingTask.cancel();
            } catch {
                // Ignore
            }
            renderTasksRef.current.delete(pageNum);
        }

        try {
            const page = await pdf.getPage(pageNum);
            const context = canvas.getContext("2d");
            if (!context) return;

            const viewport = page.getViewport({ scale });

            canvas.height = viewport.height;
            canvas.width = viewport.width;
            context.clearRect(0, 0, canvas.width, canvas.height);

            const renderTask = page.render({
                canvasContext: context,
                viewport,
                canvas,
            });

            renderTasksRef.current.set(pageNum, renderTask);
            await renderTask.promise;
            renderTasksRef.current.delete(pageNum);

            setRenderedPages(prev => new Set(prev).add(pageNum));
        } catch (e) {
            if (e instanceof Error && e.message.includes("Rendering cancelled")) {
                return;
            }
            console.error(`Failed to render page ${pageNum}:`, e);
        }
    }, [pdf, scale, renderedPages]);

    // Clear rendered pages when scale changes
    useEffect(() => {
        setRenderedPages(new Set());
    }, [scale]);

    // Set up intersection observer for lazy loading
    useEffect(() => {
        const options = {
            root: containerRef.current,
            rootMargin: "200px 0px", // Pre-load pages 200px before they become visible
            threshold: 0.1,
        };

        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const pageNum = parseInt(entry.target.getAttribute("data-page") || "0");
                    if (pageNum > 0) {
                        renderPage(pageNum);
                    }
                }
            });

            // Find the most visible page
            const visibleEntries = entries.filter(e => e.isIntersecting);
            if (visibleEntries.length > 0 && !isScrollingRef.current) {
                // Sort by intersection ratio to find the most visible
                const mostVisible = visibleEntries.reduce((prev, current) =>
                    (current.intersectionRatio > prev.intersectionRatio) ? current : prev
                );
                const pageNum = parseInt(mostVisible.target.getAttribute("data-page") || "0");
                if (pageNum > 0) {
                    setVisiblePage(pageNum);
                }
            }
        }, options);

        // Observe all page containers
        pageRefs.current.forEach((element) => {
            observerRef.current?.observe(element);
        });

        return () => {
            observerRef.current?.disconnect();
        };
    }, [renderPage, pdf.numPages]);

    // Sync visible page with parent
    useEffect(() => {
        if (visiblePage !== currentPage && onPageChange) {
            const timeout = setTimeout(() => {
                onPageChange(visiblePage);
            }, 150);
            return () => clearTimeout(timeout);
        }
    }, [visiblePage, currentPage, onPageChange]);

    // Scroll to page when currentPage changes externally
    useEffect(() => {
        if (currentPage !== visiblePage) {
            const pageElement = pageRefs.current.get(currentPage);
            if (pageElement && containerRef.current) {
                isScrollingRef.current = true;
                pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
                setTimeout(() => {
                    isScrollingRef.current = false;
                    setVisiblePage(currentPage);
                }, 500);
            }
        }
    }, [currentPage]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                setScale((s) => Math.min(s + 0.25, 3));
            } else if (e.key === "-") {
                e.preventDefault();
                setScale((s) => Math.max(s - 0.25, 0.5));
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const progressPercent = pdf.numPages > 0 ? (visiblePage / pdf.numPages) * 100 : 0;

    return (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-muted/30">
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-secondary/30 z-20">
                <div
                    className="h-full bg-primary/80 transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Controls */}
            <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                {/* Zoom Controls */}
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-background/90 backdrop-blur-md border border-border/50 px-3 py-2 shadow-lg pointer-events-auto">
                    <button
                        onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/80 transition-colors text-foreground text-sm font-medium"
                        aria-label="Zoom out"
                    >
                        −
                    </button>
                    <span className="text-xs font-medium text-muted-foreground min-w-[3.5rem] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/80 transition-colors text-foreground text-sm font-medium"
                        aria-label="Zoom in"
                    >
                        +
                    </button>
                </div>

                {/* Page indicator */}
                <div className="inline-flex items-center gap-2 rounded-xl bg-background/90 backdrop-blur-md border border-border/50 px-3 py-2 shadow-lg pointer-events-auto">
                    <span className="text-xs font-semibold text-foreground">{visiblePage}</span>
                    <span className="text-xs text-muted-foreground">/ {pdf.numPages}</span>
                </div>
            </div>

            {/* Scrollable PDF container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto scroll-smooth pt-16 pb-8"
            >
                <div className="flex flex-col items-center gap-6 px-4">
                    {allPages.map((pageNum) => (
                        <div
                            key={pageNum}
                            ref={(el) => {
                                if (el) {
                                    pageRefs.current.set(pageNum, el);
                                    observerRef.current?.observe(el);
                                } else {
                                    pageRefs.current.delete(pageNum);
                                }
                            }}
                            data-page={pageNum}
                            className={`
                                relative rounded-lg overflow-hidden shadow-xl
                                ring-1 ring-black/5 dark:ring-white/5
                                ${isDark ? "invert hue-rotate-180" : ""}
                            `}
                            style={{
                                background: isDark ? "#1a1a2e" : "#ffffff",
                                minHeight: "200px",
                            }}
                        >
                            {/* Page number */}
                            <div className={`
                                absolute top-3 right-3 z-10 px-2 py-1 rounded-md text-[10px] font-medium
                                ${isDark
                                    ? "bg-white/10 text-white invert hue-rotate-180"
                                    : "bg-black/5 text-black/60"
                                }
                            `}>
                                {pageNum}
                            </div>

                            {/* Canvas */}
                            <canvas
                                ref={(el) => {
                                    if (el) {
                                        canvasRefs.current.set(pageNum, el);
                                    } else {
                                        canvasRefs.current.delete(pageNum);
                                    }
                                }}
                                className="block"
                            />

                            {/* Loading placeholder */}
                            {!renderedPages.has(pageNum) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-secondary/20">
                                    <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
