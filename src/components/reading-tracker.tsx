"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Time01Icon,
    ZapIcon,
    ChartHistogramIcon,
    Cancel01Icon
} from "@hugeicons/core-free-icons";
import type { ReadingSession } from "@/hooks/use-reading-stats";

interface ReadingTrackerProps {
    isOpen: boolean;
    onClose: () => void;
    stats: ReadingSession;
    currentSessionFn: () => number;
}

export function ReadingTracker({ isOpen, onClose, stats, currentSessionFn }: ReadingTrackerProps) {
    const [elapsed, setElapsed] = useState(0);

    // Update timer every second
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setElapsed(currentSessionFn());
        }, 1000);
        setElapsed(currentSessionFn());
        return () => clearInterval(interval);
    }, [isOpen, currentSessionFn]);

    // Format time helpers
    const formatTime = (ms: number) => {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)));
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const formatShortTime = (ms: number) => {
        if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
        const mins = Math.floor(ms / 60000);
        if (mins === 0) return `${Math.floor(ms / 1000)}s`;
        return `${mins}m`;
    };

    // calculate velocity (pages per hour)
    const velocity = useMemo(() => {
        if (stats.pagesRead === 0 || elapsed < 1000) return 0;
        const hours = elapsed / (1000 * 60 * 60);
        return Math.round(stats.pagesRead / hours);
    }, [stats.pagesRead, elapsed]);

    // Prepare graph data (last 10 pages)
    const graphData = useMemo(() => {
        const sorted = [...stats.history].sort((a, b) => b.page - a.page).slice(0, 10).reverse();
        const maxDuration = Math.max(...sorted.map(s => s.duration), 10000); // min max 10s
        return sorted.map(s => ({
            ...s,
            height: (s.duration / maxDuration) * 100
        }));
    }, [stats.history]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Card */}
                    <motion.div
                        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm"
                        initial={{ opacity: 0, scale: 0.9, y: "-40%" }}
                        animate={{ opacity: 1, scale: 1, y: "-50%" }}
                        exit={{ opacity: 0, scale: 0.95, y: "-45%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        <div className="relative overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <h2 className="text-sm font-medium tracking-wider uppercase font-mono text-muted-foreground">Session Stats</h2>
                                </div>
                                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                                    <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
                                </button>
                            </div>

                            {/* Main Clock */}
                            <div className="px-6 py-8 text-center bg-gradient-to-b from-background to-secondary/20">
                                <div className="inline-block relative">
                                    <span className="text-6xl font-bold tracking-tighter tabular-nums text-foreground">
                                        {formatTime(elapsed)}
                                    </span>
                                    {/* Decorative elements */}
                                    <div className="absolute -top-2 -right-4 w-2 h-2 border-t border-r border-foreground/30" />
                                    <div className="absolute -bottom-2 -left-4 w-2 h-2 border-b border-l border-foreground/30" />
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground font-mono uppercase tracking-[0.2em]">Active Reading Time</p>
                            </div>

                            {/* Grid Stats */}
                            <div className="grid grid-cols-2 divide-x divide-border border-y border-border">
                                <div className="p-4 flex flex-col items-center justify-center gap-1 hover:bg-muted/30 transition-colors">
                                    <HugeiconsIcon icon={ZapIcon} size={18} className="text-yellow-500 mb-1" strokeWidth={2} />
                                    <span className="text-2xl font-semibold tabular-nums">{velocity}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono uppercase">Pages / Hour</span>
                                </div>
                                <div className="p-4 flex flex-col items-center justify-center gap-1 hover:bg-muted/30 transition-colors">
                                    <HugeiconsIcon icon={ChartHistogramIcon} size={18} className="text-blue-500 mb-1" strokeWidth={2} />
                                    <span className="text-2xl font-semibold tabular-nums">{stats.pagesRead}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono uppercase">Pages Read</span>
                                </div>
                            </div>

                            {/* Graph Section */}
                            <div className="p-6 bg-background">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-medium text-muted-foreground">Recent Flow</span>
                                    <span className="text-[10px] font-mono text-muted-foreground opacity-50">LAST 10 PAGES</span>
                                </div>

                                {graphData.length > 0 ? (
                                    <div className="h-32 flex items-end justify-between gap-2">
                                        {graphData.map((d, i) => (
                                            <div key={d.page} className="flex-1 flex flex-col items-center gap-2 group">
                                                <div className="relative w-full flex items-end h-full">
                                                    <motion.div
                                                        className="w-full bg-foreground/10 rounded-t-sm group-hover:bg-foreground/20 transition-colors relative overflow-hidden"
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${d.height}%` }}
                                                        transition={{ type: "spring", bounce: 0, delay: i * 0.05 }}
                                                    >
                                                        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-foreground/5 opacity-50" />
                                                    </motion.div>
                                                    {/* Tooltip on hover */}
                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border border-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                                        Page {d.page}: {formatShortTime(d.duration)}
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-mono text-muted-foreground/50">{d.page}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-32 flex items-center justify-center border-2 border-dashed border-border/50 rounded-lg">
                                        <div className="text-center space-y-2">
                                            <HugeiconsIcon icon={Time01Icon} size={24} className="text-muted-foreground mx-auto opacity-50" />
                                            <p className="text-xs text-muted-foreground">Start reading to see stats</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-3 bg-muted/20 border-t border-border flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                                <span>SESSION ID: {stats.startTime.toString(36).toUpperCase()}</span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                                    TRACKING ACTIVE
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
