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

interface PageCanvas {
    pageNum: number;
    canvasRef: HTMLCanvasElement | null;
    renderTask: RenderTask | null;
}

export function PdfViewer({ pdf, currentPage, pagesPerView = 1, onPageChange }: PdfViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
    const renderTasksRef = useRef<Map<number, RenderTask>>(new Map());
    const [scale, setScale] = useState(1.5);
    const [isRendering, setIsRendering] = useState(false);
    const lastScrollTime = useRef(0);
    const scrollAccumulator = useRef(0);
    const { theme } = useTheme();

    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    // Calculate which pages to display based on current page and pagesPerView
    const getVisiblePages = useCallback(() => {
        const startPage = Math.floor((currentPage - 1) / pagesPerView) * pagesPerView + 1;
        const pages: number[] = [];
        for (let i = 0; i < pagesPerView; i++) {
            const pageNum = startPage + i;
            if (pageNum <= pdf.numPages) {
                pages.push(pageNum);
            }
        }
        return pages;
    }, [currentPage, pagesPerView, pdf.numPages]);

    const visiblePages = getVisiblePages();

    // Render a single page
    const renderPage = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
        // Cancel any existing render for this page
        const existingTask = renderTasksRef.current.get(pageNum);
        if (existingTask) {
            try {
                existingTask.cancel();
            } catch {
                // Ignore cancellation errors
            }
            renderTasksRef.current.delete(pageNum);
        }

        try {
            const page = await pdf.getPage(pageNum);
            const context = canvas.getContext("2d");
            if (!context) return;

            const viewport = page.getViewport({ scale });

            // Set canvas dimensions
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Clear the canvas
            context.clearRect(0, 0, canvas.width, canvas.height);

            // Start rendering
            const renderTask = page.render({
                canvasContext: context,
                viewport,
                canvas,
            });

            renderTasksRef.current.set(pageNum, renderTask);
            await renderTask.promise;
            renderTasksRef.current.delete(pageNum);
        } catch (e) {
            if (e instanceof Error && e.message.includes("Rendering cancelled")) {
                return;
            }
            console.error(`Failed to render page ${pageNum}:`, e);
        }
    }, [pdf, scale]);

    // Render all visible pages
    useEffect(() => {
        let cancelled = false;

        const renderAllPages = async () => {
            setIsRendering(true);

            for (const pageNum of visiblePages) {
                if (cancelled) break;
                const canvas = canvasRefs.current.get(pageNum);
                if (canvas) {
                    await renderPage(pageNum, canvas);
                }
            }

            if (!cancelled) {
                setIsRendering(false);
            }
        };

        // Small delay to allow canvas refs to be set
        const timer = setTimeout(renderAllPages, 10);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            // Cancel all pending renders
            renderTasksRef.current.forEach((task) => {
                try {
                    task.cancel();
                } catch {
                    // Ignore
                }
            });
            renderTasksRef.current.clear();
        };
    }, [visiblePages, renderPage]);

    // Instagram Reel-like scroll navigation
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;

        const handleWheel = (e: WheelEvent) => {
            const now = Date.now();
            const timeDelta = now - lastScrollTime.current;

            // Reset accumulator if there's been a pause in scrolling
            if (timeDelta > 300) {
                scrollAccumulator.current = 0;
            }
            lastScrollTime.current = now;

            // Check if we're at the scroll boundaries
            const isAtBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 10;
            const isAtTop = scrollContainer.scrollTop <= 10;

            // Only intercept if we're at a boundary and trying to scroll further
            if ((isAtBottom && e.deltaY > 0) || (isAtTop && e.deltaY < 0)) {
                scrollAccumulator.current += Math.abs(e.deltaY);

                // Threshold for page navigation (adjust sensitivity here)
                const threshold = 150;

                if (scrollAccumulator.current >= threshold) {
                    scrollAccumulator.current = 0;

                    if (e.deltaY > 0) {
                        // Scrolling down - go to next set of pages
                        const lastVisible = visiblePages[visiblePages.length - 1];
                        if (lastVisible !== undefined) {
                            const nextStartPage = lastVisible + 1;
                            if (nextStartPage <= pdf.numPages) {
                                onPageChange?.(nextStartPage);
                                // Reset scroll to top for new pages
                                setTimeout(() => {
                                    scrollContainer.scrollTop = 0;
                                }, 50);
                            }
                        }
                    } else {
                        // Scrolling up - go to previous set of pages
                        const firstVisible = visiblePages[0];
                        if (firstVisible !== undefined) {
                            const prevStartPage = firstVisible - pagesPerView;
                            if (prevStartPage >= 1) {
                                onPageChange?.(prevStartPage);
                                // Reset scroll to bottom for previous pages
                                setTimeout(() => {
                                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                                }, 50);
                            }
                        }
                    }
                }
            }
        };

        scrollContainer.addEventListener("wheel", handleWheel, { passive: true });
        return () => scrollContainer.removeEventListener("wheel", handleWheel);
    }, [visiblePages, pagesPerView, pdf.numPages, onPageChange]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                const lastVisible = visiblePages[visiblePages.length - 1];
                if (lastVisible !== undefined) {
                    const nextStartPage = lastVisible + 1;
                    if (nextStartPage <= pdf.numPages) {
                        onPageChange?.(nextStartPage);
                    }
                }
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                const firstVisible = visiblePages[0];
                if (firstVisible !== undefined) {
                    const prevStartPage = firstVisible - pagesPerView;
                    if (prevStartPage >= 1) {
                        onPageChange?.(prevStartPage);
                    }
                }
            } else if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                setScale((s) => Math.min(s + 0.25, 3));
            } else if (e.key === "-") {
                e.preventDefault();
                setScale((s) => Math.max(s - 0.25, 0.5));
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [visiblePages, pagesPerView, pdf.numPages, onPageChange]);

    // Get grid layout based on pages per view
    const getGridClass = () => {
        switch (pagesPerView) {
            case 1:
                return "grid-cols-1";
            case 2:
                return "grid-cols-1 md:grid-cols-2";
            case 4:
                return "grid-cols-1 md:grid-cols-2";
            default:
                return "grid-cols-1";
        }
    };

    return (
        <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden bg-muted/30 flex flex-col"
        >
            {/* Zoom Controls */}
            <div className="sticky top-4 left-4 z-10 inline-flex items-center gap-2 rounded-xl bg-background/80 backdrop-blur-md border border-border px-3 py-2 shadow-lg m-4 w-fit">
                <button
                    onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-foreground"
                    aria-label="Zoom out"
                >
                    −
                </button>
                <span className="text-sm font-medium text-muted-foreground min-w-[4rem] text-center">
                    {Math.round(scale * 100)}%
                </span>
                <button
                    onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-foreground"
                    aria-label="Zoom in"
                >
                    +
                </button>
            </div>

            {/* PDF Pages Container - Scrollable */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-auto px-4 pb-8"
            >
                <div className={`grid ${getGridClass()} gap-6 justify-items-center max-w-fit mx-auto`}>
                    {visiblePages.map((pageNum) => (
                        <div
                            key={pageNum}
                            className={`
                                relative shadow-2xl rounded-lg overflow-hidden transition-all duration-300
                                ${isDark ? "invert hue-rotate-180" : ""}
                            `}
                            style={{
                                background: isDark ? "#1a1a2e" : "#ffffff",
                            }}
                        >
                            {/* Page number badge */}
                            <div className={`
                                absolute top-3 right-3 z-10 px-2.5 py-1 rounded-lg text-xs font-medium
                                ${isDark ? "bg-white/10 text-white invert hue-rotate-180" : "bg-black/10 text-black"}
                            `}>
                                Page {pageNum}
                            </div>
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
                        </div>
                    ))}
                </div>

                {/* Scroll indicator for multi-page view */}
                {pagesPerView > 1 && visiblePages.length > 0 && (visiblePages[visiblePages.length - 1] ?? 0) < pdf.numPages && (
                    <div className="flex justify-center py-8">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground animate-bounce">
                            <span className="text-sm font-medium">Keep scrolling for more pages</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading overlay */}
            {isRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-none">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}
