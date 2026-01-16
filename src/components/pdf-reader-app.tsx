"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PdfProvider, usePdf } from "@/components/providers/pdf-provider";
import { LibrarySidebar } from "@/components/library-sidebar";
import { ReaderView } from "@/components/reader-view";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { useReadingAnalytics } from "@/hooks/use-reading-stats";
import { ReadingTracker } from "@/components/reading-tracker";

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "i") {
                e.preventDefault();
                // Dispatch a custom event that PdfReaderApp can listen to
                window.dispatchEvent(new CustomEvent("toggle-reading-timer"));
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    }, [matches, query]);

    return matches;
}

function PdfReaderAppContent() {
    const { currentDocument } = usePdf();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const commandPalette = useCommandPalette();
    const isDesktop = useMediaQuery("(min-width: 1024px)");

    // Reading analytics (includes live stats + persisted dashboard data)
    const readingAnalytics = useReadingAnalytics();

    // Automatically open sidebar when no document is selected
    useEffect(() => {
        if (!currentDocument) {
            setSidebarOpen(true);
        }
    }, [currentDocument]);

    // Handle keyboard shortcut for toggling tracker visibility
    useEffect(() => {
        const handleToggleTimer = () => {
            readingAnalytics.setIsOpen(prev => !prev);
        };

        window.addEventListener("toggle-reading-timer", handleToggleTimer);
        return () => window.removeEventListener("toggle-reading-timer", handleToggleTimer);
    }, [readingAnalytics]);

    const sidebarVariants = {
        mobile: {
            x: sidebarOpen ? 0 : "-100%",
            width: "auto",
            opacity: 1,
            transition: { type: "spring", damping: 25, stiffness: 300 } as const
        },
        desktop: {
            x: 0,
            width: sidebarOpen ? "auto" : 0,
            opacity: sidebarOpen ? 1 : 0,
            transition: { type: "spring", damping: 25, stiffness: 300 } as const
        }
    };

    return (
        <>
            <div className="h-screen flex overflow-hidden bg-background">
                {/* Sidebar - responsive motion */}
                <motion.div
                    className={`
                        fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto
                        border-r border-border bg-background overflow-hidden
                    `}
                    initial={false}
                    animate={isDesktop ? "desktop" : "mobile"}
                    variants={sidebarVariants}
                >
                    <div className="w-80 h-full">
                        <LibrarySidebar
                            onDocumentOpen={() => setSidebarOpen(false)}
                            currentStats={readingAnalytics.stats}
                        />
                    </div>
                </motion.div>

                {/* Backdrop for mobile */}
                <AnimatePresence>
                    {sidebarOpen && !isDesktop && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-30 bg-black/50 lg:hidden backdrop-blur-[1px]"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}
                </AnimatePresence>

                {/* Main content */}
                <ReaderView
                    onMenuClick={() => setSidebarOpen(true)}
                    onShowStats={() => readingAnalytics.setIsOpen(true)}
                    currentStats={readingAnalytics.stats}
                    dashboard={readingAnalytics.dashboard}
                />
            </div>

            {/* Command Palette */}
            <CommandPalette
                open={commandPalette.open}
                onClose={commandPalette.onClose}
                onShowStats={() => readingAnalytics.setIsOpen(true)}
            />

            {/* Reading Stats Overlay */}
            <ReadingTracker
                isOpen={readingAnalytics.isOpen}
                onClose={() => readingAnalytics.setIsOpen(false)}
                stats={readingAnalytics.stats}
                currentSessionFn={readingAnalytics.stats.totalDuration as () => number}
                isPaused={readingAnalytics.isPaused}
                onTogglePause={readingAnalytics.togglePause}
            />
        </>
    );
}

export function PdfReaderApp() {
    return (
        <PdfProvider>
            <PdfReaderAppContent />
        </PdfProvider>
    );
}
