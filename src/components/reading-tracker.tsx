"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Wifi01Icon,
    RefreshIcon,
    StopIcon,
    RecordIcon,
    BatteryFullIcon,
    PlayIcon,
    PauseIcon
} from "@hugeicons/core-free-icons";
import type { ReadingSession } from "@/hooks/use-reading-stats";
import { cn } from "@/lib/utils";

interface ReadingTrackerProps {
    isOpen: boolean;
    onClose: () => void;
    stats: ReadingSession;
    currentSessionFn: () => number;
}

export function ReadingTracker({ isOpen, onClose, stats, currentSessionFn }: ReadingTrackerProps) {
    const [elapsed, setElapsed] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const controls = useDragControls();

    // Update timer every second
    useEffect(() => {
        if (!isOpen) return;

        // Immediate update
        setElapsed(currentSessionFn());

        const interval = setInterval(() => {
            if (!isPaused) {
                setElapsed(currentSessionFn());
            }
        }, 100); // Higher frequency for smoother feel if needed, though 1s is fine for seconds

        return () => clearInterval(interval);
    }, [isOpen, currentSessionFn, isPaused]);

    // Format time: HH:MM:SS
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);

        const hDisplay = hours > 0 ? `${hours.toString().padStart(2, '0')}:` : '';
        const mDisplay = minutes.toString().padStart(2, '0');
        const sDisplay = seconds.toString().padStart(2, '0');

        return `${hDisplay}${mDisplay}:${sDisplay}`;
    };

    // Live Clock for Top Bar
    const [currentTime, setCurrentTime] = useState("");
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        };
        updateTime();
        const timer = setInterval(updateTime, 60000);
        return () => clearInterval(timer);
    }, []);

    // Calculate real stats
    const pagesPerHour = useMemo(() => {
        // Avoid NaN or Infinity
        if (!elapsed || elapsed === 0 || stats.pagesRead === 0) return 0;
        const hours = elapsed / (1000 * 60 * 60);
        return Math.round(stats.pagesRead / hours);
    }, [elapsed, stats.pagesRead]);

    // Generate REAL waveform data from history
    // Each bar represents a page. Height = relative duration.
    const waveformBars = useMemo(() => {
        const barsCount = 30; // Number of bars to display
        const history = stats.history || [];

        // If no history, show flat line
        if (history.length === 0) {
            return new Array(barsCount).fill({ height: 5, page: 0 }); // 5% height baseline
        }

        // Get last N pages
        const recentPages = history.slice(-barsCount);

        // Find max duration for scaling (avoid div by zero)
        const maxDuration = Math.max(...recentPages.map(p => p.duration), 1000); // min 1s baseline

        return recentPages.map(page => {
            // Scale 5% to 100%
            const height = Math.max(5, (page.duration / maxDuration) * 100);
            return { height, page: page.page };
        });
    }, [stats.history]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    drag
                    dragControls={controls}
                    dragMomentum={false}
                    initial={{ opacity: 0, y: 100, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.9 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-8 right-8 z-50"
                >
                    {/* Device Casing */}
                    <div className="w-[280px] bg-[#E8E8E8] rounded-[32px] p-2.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)] border border-white/50 backdrop-blur-xl relative group">

                        {/* Grabbable Area Tip */}
                        <div
                            className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                            onPointerDown={(e) => controls.start(e)}
                        />

                        {/* Screen Area */}
                        <div className="bg-[#1A1A1A] rounded-[24px] h-[340px] flex flex-col relative overflow-hidden shadow-inner ring-1 ring-black/5 mt-4">
                            {/* Screen Glare/Texture Overlay */}
                            <div className="absolute inset-0 bg-white/[0.02] mix-blend-overlay pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />

                            {/* Status Bar */}
                            <div className="flex justify-between items-center px-5 py-4 text-[10px] font-medium tracking-wider text-neutral-500 font-mono">
                                <span>{currentTime}</span>
                                <div className="flex items-center gap-2">
                                    {!isPaused ? (
                                        <span className="flex items-center gap-1.5 text-red-500 animate-pulse">
                                            <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                            RECORDING
                                        </span>
                                    ) : (
                                        <span className="text-neutral-600 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                                            PAUSED
                                        </span>
                                    )}
                                    <HugeiconsIcon icon={BatteryFullIcon} size={14} className="text-neutral-400 ml-1" />
                                </div>
                            </div>

                            {/* Waveform Visualization (Real Data) */}
                            <div className="flex-1 flex items-end justify-center gap-[3px] px-6 pb-2 opacity-90 overflow-hidden">
                                {waveformBars.length > 0 ? (
                                    waveformBars.map((bar, i) => (
                                        <div
                                            key={i}
                                            className="relative flex-1 group/bar"
                                        >
                                            <div
                                                className="w-full rounded-sm bg-neutral-700 transition-all duration-500 ease-out flex items-end justify-center"
                                                style={{
                                                    height: `${bar.height / 2 /* scale visual height down slightly to fit */}px`,
                                                    minHeight: '4px',
                                                    backgroundColor: !isPaused && i === waveformBars.length - 1 ? '#ef4444' : undefined
                                                }}
                                            />
                                            {/* Tooltip for page number */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[9px] bg-white text-black px-1 rounded opacity-0 group-hover/bar:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                                                Page {bar.page}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-neutral-700 text-[10px] font-mono tracking-widest uppercase">
                                        Waiting for input...
                                    </div>
                                )}

                                {/* Center Line / Playhead */}
                                <div className="absolute inset-x-0 bottom-8 h-px bg-white/5 pointer-events-none" />
                            </div>

                            {/* Main Timer & Metrics */}
                            <div className="px-6 pb-6 text-center">
                                {/* Timer */}
                                <span className={cn(
                                    "text-5xl font-light tracking-tighter tabular-nums font-sans transition-colors block mb-4",
                                    isPaused ? "text-neutral-500" : "text-white"
                                )}>
                                    {formatTime(elapsed)}
                                </span>

                                {/* Real Stats Row */}
                                <div className="flex items-center justify-center divide-x divide-neutral-800 border-t border-neutral-800 pt-3">
                                    <div className="px-4 flex flex-col items-center">
                                        <span className="text-xl font-medium text-white tabular-nums">{stats.pagesRead}</span>
                                        <span className="text-[9px] text-neutral-500 font-mono tracking-wider uppercase">PAGES</span>
                                    </div>
                                    <div className="px-4 flex flex-col items-center">
                                        <span className="text-xl font-medium text-white tabular-nums">{pagesPerHour}</span>
                                        <span className="text-[9px] text-neutral-500 font-mono tracking-wider uppercase">PG/HR</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Physical Controls Area */}
                        <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-2 mt-2.5 h-[85px]">
                            {/* Record/Pause Button */}
                            <button
                                onClick={() => setIsPaused(!isPaused)}
                                className="bg-[#E0E0E0] hover:bg-[#D6D6D6] rounded-[20px] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_4px_rgba(0,0,0,0.05)] border-t border-white transition-all active:scale-[0.98] active:shadow-inner group/btn"
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-300",
                                    !isPaused ? "bg-red-500/10 text-red-500" : "bg-transparent text-neutral-400"
                                )}>
                                    <div className={cn(
                                        "rounded-full transition-all duration-300",
                                        !isPaused ? "w-3 h-3 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]" : "w-3 h-3 bg-neutral-400"
                                    )} />
                                </div>
                            </button>

                            {/* Stop/Close Button - Large Center */}
                            <button
                                onClick={onClose}
                                className="bg-[#E0E0E0] hover:bg-[#D6D6D6] rounded-[24px] flex flex-col items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_4px_rgba(0,0,0,0.05)] border-t border-white transition-all active:scale-[0.98] active:shadow-inner gap-1"
                            >
                                <div className="w-12 h-12 rounded-full bg-[#F0F0F0] shadow-[inset_0_2px_5px_rgba(0,0,0,0.05),0_1px_0_rgba(255,255,255,1)] flex items-center justify-center mb-0.5">
                                    <div className="w-4 h-4 rounded-[3px] bg-neutral-800" />
                                </div>
                            </button>

                            {/* Stats/Toggle Button */}
                            <div className="flex flex-col gap-2">
                                <button className="flex-1 bg-[#E0E0E0] hover:bg-[#D6D6D6] rounded-[20px] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_4px_rgba(0,0,0,0.05)] border-t border-white transition-all active:scale-[0.98] active:shadow-inner">
                                    <HugeiconsIcon icon={Wifi01Icon} size={16} className="text-neutral-400" />
                                </button>
                                <button
                                    className="flex-1 bg-[#E0E0E0] hover:bg-[#D6D6D6] rounded-[20px] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_4px_rgba(0,0,0,0.05)] border-t border-white transition-all active:scale-[0.98] active:shadow-inner"
                                    onClick={() => setElapsed(currentSessionFn())}
                                >
                                    <HugeiconsIcon icon={RefreshIcon} size={16} className="text-neutral-400" />
                                </button>
                            </div>
                        </div>

                        {/* Speaker Grille Detail - More realistic mesh */}
                        <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-1 opacity-20 pointer-events-none w-32 justify-center flex-wrap">
                            {[...Array(24)].map((_, i) => (
                                <div key={i} className="w-[2px] h-[2px] rounded-full bg-black/60" />
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
