"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import * as pdfjsLib from "pdfjs-dist";
import "@/styles/pdf_viewer.css";
import { useTheme } from "better-themes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

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
    const textLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const renderTasksRef = useRef<Map<number, RenderTask>>(new Map());
    const renderingPagesRef = useRef<Set<number>>(new Set()); // Track pages currently being rendered
    const observerRef = useRef<IntersectionObserver | null>(null);
    const [scale, setScale] = useState(1.5);
    const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
    const [visiblePage, setVisiblePage] = useState(currentPage);
    const [estimatedPageHeight, setEstimatedPageHeight] = useState(800 * 1.5);
    const [direction, setDirection] = useState(0); // -1 for up, 1 for down
    const previousVisiblePage = useRef(currentPage);
    // Start with scrolling lock if we need to scroll to a non-first page on mount
    const isScrollingRef = useRef(currentPage !== 1);
    const initialScrollDoneRef = useRef(false);
    const { theme } = useTheme();

    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    // Generate all page numbers
    const allPages = Array.from({ length: pdf.numPages }, (_, i) => i + 1);

    // Render a single page with proper locking
    const renderPage = useCallback(async (pageNum: number) => {
        const canvas = canvasRefs.current.get(pageNum);
        if (!canvas) return;

        // Skip if already rendered at current scale
        if (renderedPages.has(pageNum)) return;

        // Skip if already rendering this page (prevents concurrent render on same canvas)
        if (renderingPagesRef.current.has(pageNum)) return;

        // Cancel any existing task for this page
        const existingTask = renderTasksRef.current.get(pageNum);
        if (existingTask) {
            try {
                existingTask.cancel();
                // Wait a tick for cancellation to process
                await new Promise(resolve => setTimeout(resolve, 10));
            } catch {
                // Ignore cancellation errors
            }
            renderTasksRef.current.delete(pageNum);
        }

        // Mark as rendering
        renderingPagesRef.current.add(pageNum);

        try {
            const page = await pdf.getPage(pageNum);
            const context = canvas.getContext("2d");
            if (!context) {
                renderingPagesRef.current.delete(pageNum);
                return;
            }

            const viewport = page.getViewport({ scale });
            // HiDPI / Retina display support
            const dpr = window.devicePixelRatio || 1;

            canvas.height = Math.floor(viewport.height * dpr);
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            context.clearRect(0, 0, canvas.width, canvas.height);

            const renderTask = page.render({
                canvasContext: context,
                viewport,
                canvas,
                transform: [dpr, 0, 0, dpr, 0, 0],
            });

            renderTasksRef.current.set(pageNum, renderTask);
            await renderTask.promise;
            renderTasksRef.current.delete(pageNum);

            // Text Layer
            const textLayerDiv = textLayerRefs.current.get(pageNum);
            if (textLayerDiv) {
                textLayerDiv.innerHTML = "";
                textLayerDiv.style.setProperty("--total-scale-factor", `${scale}`);
                textLayerDiv.style.width = `${viewport.width}px`;
                textLayerDiv.style.height = `${viewport.height}px`;

                const textContent = await page.getTextContent();
                const textLayer = new (pdfjsLib as any).TextLayer({
                    textContentSource: textContent,
                    container: textLayerDiv,
                    viewport: viewport,
                });
                await textLayer.render();
            }

            setRenderedPages(prev => new Set(prev).add(pageNum));
        } catch (e) {
            // Handle expected errors gracefully
            if (e instanceof Error) {
                const msg = e.message.toLowerCase();
                // Ignore cancellation and concurrent render errors
                if (msg.includes("cancelled") || msg.includes("multiple render")) {
                    return;
                }
            }
            console.error(`Failed to render page ${pageNum}:`, e);
        } finally {
            // Always release the lock
            renderingPagesRef.current.delete(pageNum);
        }
    }, [pdf, scale, renderedPages]);

    // Clear rendered pages when scale changes, and update estimated height
    useEffect(() => {
        setRenderedPages(new Set());

        // Update estimate based on scale
        pdf.getPage(1).then(page => {
            const viewport = page.getViewport({ scale });
            setEstimatedPageHeight(viewport.height);
        }).catch(err => {
            console.error("Failed to estimate page height:", err);
        });
    }, [scale, pdf]);

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
                    const diff = pageNum - previousVisiblePage.current;
                    if (diff !== 0) {
                        setDirection(diff > 0 ? 1 : -1);
                        previousVisiblePage.current = pageNum;
                        setVisiblePage(pageNum);
                    }
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

    // Sync visible page with parent - but not during initial scroll
    useEffect(() => {
        // Don't sync during initial scroll
        if (!initialScrollDoneRef.current && currentPage !== 1) {
            return;
        }
        if (visiblePage !== currentPage && onPageChange && !isScrollingRef.current) {
            const timeout = setTimeout(() => {
                onPageChange(visiblePage);
            }, 150);
            return () => clearTimeout(timeout);
        }
    }, [visiblePage, currentPage, onPageChange]);

    // Initial scroll to starting page on mount
    useEffect(() => {
        if (initialScrollDoneRef.current) return;

        // Use a small delay to ensure pages are rendered
        const timer = setTimeout(() => {
            if (currentPage !== 1) {
                const pageElement = pageRefs.current.get(currentPage);
                if (pageElement && containerRef.current) {
                    pageElement.scrollIntoView({ behavior: "auto", block: "start" });
                    setVisiblePage(currentPage);
                    previousVisiblePage.current = currentPage;
                }
            }
            // Mark initial scroll as done and release the lock
            initialScrollDoneRef.current = true;
            isScrollingRef.current = false;
        }, 100);

        return () => clearTimeout(timer);
    }, []); // Only run on mount

    // Scroll to page when currentPage changes externally (after initial mount)
    useEffect(() => {
        // Skip the initial mount - handled by the effect above
        if (!initialScrollDoneRef.current) return;

        const scrollToPage = async () => {
            if (currentPage !== visiblePage) {
                const pageElement = pageRefs.current.get(currentPage);
                if (pageElement && containerRef.current) {
                    isScrollingRef.current = true;

                    // "auto" = instant jump
                    pageElement.scrollIntoView({ behavior: "auto", block: "start" });

                    // Update direction
                    const diff = currentPage - visiblePage;
                    if (diff !== 0) {
                        setDirection(diff > 0 ? 1 : -1);
                        previousVisiblePage.current = currentPage;
                    }

                    // Force update our local state to match immediately
                    setVisiblePage(currentPage);

                    // Keep lock active briefly to let any layout shifts settle 
                    setTimeout(() => {
                        isScrollingRef.current = false;
                    }, 500);
                }
            }
        };

        scrollToPage();
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
        <div className="relative flex-1 flex flex-col overflow-hidden bg-muted/20">
            {/* Progress bar */}
            <div
                className="absolute top-0 left-0 right-0 h-1.5 z-50 cursor-pointer group"
                onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(1, x / rect.width));
                    const targetPage = Math.max(1, Math.ceil(percentage * pdf.numPages));
                    if (onPageChange && targetPage !== visiblePage) {
                        onPageChange(targetPage);
                    }
                }}
            >
                {/* Background track (visible on hover) */}
                <div className="absolute inset-0 bg-transparent group-hover:bg-muted/50 transition-colors" />

                {/* Fill */}
                <div
                    className="absolute top-0 left-0 bottom-0 bg-red-600 transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Controls */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
                {/* Zoom Controls */}
                <div className="inline-flex items-center border border-border bg-background/95 backdrop-blur-sm pointer-events-auto">
                    <button
                        onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary transition-colors text-foreground text-xs font-medium border-r border-border"
                        aria-label="Zoom out"
                    >
                        −
                    </button>
                    <span className="text-[10px] font-mono text-muted-foreground min-w-[3rem] text-center px-2">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary transition-colors text-foreground text-xs font-medium border-l border-border"
                        aria-label="Zoom in"
                    >
                        +
                    </button>
                </div>

                {/* Page indicator
                <div className="inline-flex items-center gap-1.5 border border-border bg-background/95 backdrop-blur-sm px-2.5 py-1.5 pointer-events-auto overflow-hidden h-8 min-w-[3.5rem] justify-center">
                    <div className="relative h-[1.2em] w-[2ch] text-center">
                        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                            <motion.span
                                key={visiblePage}
                                custom={direction}
                                variants={{
                                    enter: (direction: number) => ({
                                        y: direction > 0 ? "100%" : "-100%",
                                        opacity: 0,
                                        position: "absolute",
                                    }),
                                    center: {
                                        y: 0,
                                        opacity: 1,
                                        position: "relative",
                                    },
                                    exit: (direction: number) => ({
                                        y: direction > 0 ? "-100%" : "100%",
                                        opacity: 0,
                                        position: "absolute",
                                    }),
                                }}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="block text-[10px] font-mono text-foreground inset-0 w-full"
                            >
                                {visiblePage}
                            </motion.span>
                        </AnimatePresence>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">/</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{pdf.numPages}</span>
                </div> */}
            </div>

            {/* Scrollable PDF container */}
            <ScrollArea
                viewportRef={containerRef}
                className="flex-1"
                type="scroll"
                viewportClassName="pt-16 pb-8"
                scrollIndicator={
                    <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 flex items-center justify-end min-w-[3rem]">
                        <div className="bg-red-600 text-white text-[10px] font-mono font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap transition-all">
                            PG {visiblePage} <span className="opacity-50">/ {pdf.numPages}</span>
                        </div>
                        <div className="w-1 h-0.5 bg-red-600 ml-0.5 opacity-50"></div>
                    </div>
                }
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
                                relative overflow-hidden
                                ring-1 ring-border
                                ${isDark ? "invert hue-rotate-180" : ""}
                            `}
                            style={{
                                background: isDark ? "#141414" : "#ffffff",
                                minHeight: renderedPages.has(pageNum) ? "auto" : `${estimatedPageHeight}px`,
                                height: renderedPages.has(pageNum) ? "auto" : `${estimatedPageHeight}px`,
                            }}
                        >
                            {/* Page number */}
                            <div className={`
                                absolute top-2 right-2 z-10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider
                                ${isDark
                                    ? "bg-white/10 text-white invert hue-rotate-180"
                                    : "bg-black/5 text-black/50"
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

                            {/* Text Layer */}
                            <div
                                ref={(el) => {
                                    if (el) {
                                        textLayerRefs.current.set(pageNum, el);
                                    } else {
                                        textLayerRefs.current.delete(pageNum);
                                    }
                                }}
                                className="textLayer absolute inset-0"
                            />

                            {/* Loading placeholder */}
                            {!renderedPages.has(pageNum) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                                    <div className="w-4 h-4 border border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div >
    );
}
