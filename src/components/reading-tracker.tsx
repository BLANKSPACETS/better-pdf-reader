"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    PlayIcon,
    PauseIcon,
    RefreshIcon,
    ViewOffSlashIcon,
    SquareLock02Icon
} from "@hugeicons/core-free-icons";
import type { ReadingSession } from "@/hooks/use-reading-stats";
import { cn } from "@/lib/utils";

interface ReadingTrackerProps {
    isOpen: boolean;
    onClose: () => void;
    stats: ReadingSession;
    currentSessionFn: () => number;
    isPaused: boolean;
    onTogglePause: () => void;
}

export function ReadingTracker({ isOpen, onClose, stats, currentSessionFn, isPaused, onTogglePause }: ReadingTrackerProps) {
    const [elapsed, setElapsed] = useState(0);
    const [livePageDuration, setLivePageDuration] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isIdle, setIsIdle] = useState(false);
    const controls = useDragControls();

    // Ghost Mode: Track mouse movement
    useEffect(() => {
        let timer: NodeJS.Timeout;
        const resetIdle = () => {
            setIsIdle(false);
            clearTimeout(timer);
            timer = setTimeout(() => setIsIdle(true), 4000); // Fade after 4s
        };
        window.addEventListener("mousemove", resetIdle);
        resetIdle();
        return () => {
            window.removeEventListener("mousemove", resetIdle);
            clearTimeout(timer);
        };
    }, []);

    // Update timer loop
    useEffect(() => {
        if (!isOpen) return;
        setElapsed(currentSessionFn());
        if (stats.getCurrentPageDuration) setLivePageDuration(stats.getCurrentPageDuration());

        const interval = setInterval(() => {
            if (!isPaused) {
                setElapsed(currentSessionFn());
                if (stats.getCurrentPageDuration) {
                    setLivePageDuration(stats.getCurrentPageDuration());
                }
            }
        }, 100); // 30fps update for smoother feel
        return () => clearInterval(interval);
    }, [isOpen, currentSessionFn, isPaused, stats.getCurrentPageDuration]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return {
            h: hours > 0 ? hours.toString() : null,
            m: minutes.toString().padStart(2, '0'),
            s: seconds.toString().padStart(2, '0')
        };
    };

    const timeObj = formatTime(elapsed);
    const pagesPerHour = useMemo(() => {
        if (!elapsed || stats.pagesRead === 0) return 0;
        const stableDuration = Math.max(elapsed, 60 * 1000);
        const hours = stableDuration / (1000 * 60 * 60);
        return Math.round(stats.pagesRead / hours);
    }, [elapsed, stats.pagesRead]);

    // Waveform Data
    const waveformBars = useMemo(() => {
        const VISIBLE_BARS = 24;
        const history = stats.history || [];
        const allData = [...history];

        if (stats.currentPage) {
            allData.push({
                page: stats.currentPage,
                duration: isPaused ? (stats.getCurrentPageDuration ? stats.getCurrentPageDuration() : 0) : Math.max(100, livePageDuration)
            });
        }

        const recentDurations = allData.slice(-VISIBLE_BARS).map(d => d.duration);
        const maxDuration = Math.max(...recentDurations, 5000);

        const bars = [];
        for (let i = 0; i < VISIBLE_BARS; i++) {
            const dataIndex = allData.length - 1 - i;
            const item = dataIndex >= 0 ? allData[dataIndex] : undefined;
            if (item) {
                const ratio = Math.sqrt(item.duration) / Math.sqrt(maxDuration);
                // "Nothing" aesthetic: varied opaque bars
                bars.unshift({
                    type: 'data',
                    height: Math.min(100, Math.max(10, ratio * 100)),
                    active: dataIndex === allData.length - 1 && !isPaused
                });
            } else {
                bars.unshift({ type: 'empty', height: 10 + Math.sin(i * 0.9) * 5 });
            }
        }
        return bars;
    }, [stats.history, livePageDuration, isPaused, stats.currentPage]);

    // Rotation for the seconds ring
    const secondsRotation = (elapsed / 1000) * 6; // 6 degrees per second

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    drag
                    dragControls={controls}
                    dragMomentum={false}
                    initial={{ opacity: 0, scale: 0.8, y: 100 }}
                    animate={{
                        opacity: isIdle && !isHovered && !isPaused ? 0.2 : 1,
                        scale: 1,
                        y: 0
                    }}
                    exit={{ opacity: 0, scale: 0.8, y: 100 }}
                    className="fixed bottom-8 right-8 z-[100]"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* Main Container - The "Puck" */}
                    <motion.div
                        className={cn(
                            "relative bg-black rounded-[40px] shadow-2xl border border-white/10 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group",
                            isHovered
                                ? "w-[320px] h-[180px] rounded-[24px]" // Expanded rectangular dashboard
                                : "w-[120px] h-[120px] rounded-full"   // Collapsed circular dial
                        )}
                    >
                        {/* --------------------------------------------------------------------------------
                            COLLAPSED STATE: The Mechanical Dial
                           -------------------------------------------------------------------------------- */}
                        <div className={cn(
                            "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                            isHovered ? "opacity-0 pointer-events-none" : "opacity-100"
                        )}>
                            {/* Draggable surface */}
                            <div className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing" onPointerDown={(e) => controls.start(e)} />

                            {/* Outer Static Ring (Minutes ticks) */}
                            <div className="absolute inset-2 rounded-full border border-dashed border-white/10" />

                            {/* Inner Moving Ring (Seconds) - Mechanical Rotation */}
                            <motion.div
                                className="absolute inset-1 rounded-full border-t-2 border-r-2 border-transparent border-t-red-500 border-r-red-500/50"
                                style={{ rotate: secondsRotation, transition: "rotate 1s linear" }}
                            />

                            {/* Inner Content */}
                            <div className="flex flex-col items-center justify-center z-10 space-y-0.5">
                                {/* Red Pulse Dot */}
                                <div className={cn(
                                    "w-1.5 h-1.5 rounded-full mb-1",
                                    isPaused ? "bg-white/20" : "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                                )} />

                                {/* Time Display */}
                                <div className="font-mono text-xl font-bold tracking-tight leading-none text-white">
                                    {timeObj.m}:{timeObj.s}
                                </div>

                                {/* HRS indicator (if applicable) or small label */}
                                {timeObj.h && (
                                    <div className="text-[9px] font-mono text-white/40 tracking-widest">{timeObj.h} HR</div>
                                )}
                            </div>
                        </div>

                        {/* --------------------------------------------------------------------------------
                            EXPANDED STATE: The "Nothing" Dashboard
                           -------------------------------------------------------------------------------- */}
                        <div className={cn(
                            "absolute inset-0 p-5 flex flex-col transition-all duration-500 delay-75",
                            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
                        )}>
                            {/* Background Texture: Dot Grid */}
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent bg-[length:4px_4px]" />
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                            {/* Top Bar: Label & Drag */}
                            <div className="flex justify-between items-center mb-4 z-20">
                                <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing" onPointerDown={(e) => controls.start(e)}>
                                    <div className={cn("w-2 h-2 rounded-full", isPaused ? "bg-white/20" : "bg-red-500")} />
                                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/50">
                                        Session_01
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                                        <HugeiconsIcon icon={ViewOffSlashIcon} size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Metric Grid - The "Data" look */}
                            <div className="grid grid-cols-[1.5fr_1fr] flex-1 gap-4 z-20">
                                {/* Time & Waveform */}
                                <div className="flex flex-col justify-between border-r border-white/10 pr-4">
                                    <div className="font-mono text-3xl font-light tracking-tighter text-white">
                                        {timeObj.h && <span className="text-white/40 text-lg align-top mr-0.5">{timeObj.h}:</span>}
                                        {timeObj.m}:{timeObj.s}
                                    </div>

                                    {/* Waveform Bars - Nothing Style: Pixels */}
                                    <div className="flex items-end gap-[2px] h-8 mt-2">
                                        {waveformBars.map((bar, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "flex-1",
                                                    bar.type === 'data'
                                                        ? (bar.active ? "bg-red-500" : "bg-white") // Monochrome + Red only
                                                        : "bg-white/10"
                                                )}
                                                style={{ height: `${bar.height}%` }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Stats & Controls */}
                                <div className="flex flex-col justify-between pl-1">
                                    <div className="space-y-1">
                                        <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Velocity</div>
                                        <div className="text-lg font-mono text-white flex items-baseline gap-1">
                                            {pagesPerHour}
                                            <span className="text-[10px] text-white/40">PG/HR</span>
                                        </div>
                                    </div>

                                    {/* Control Cluster */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={onTogglePause}
                                            className="w-10 h-10 border border-white/20 hover:border-red-500 hover:bg-red-500/10 rounded-full flex items-center justify-center transition-all active:scale-95 group/btn"
                                            title={isPaused ? "Resume" : "Pause"}
                                        >
                                            {isPaused ? (
                                                <HugeiconsIcon icon={PlayIcon} size={16} className="text-white group-hover/btn:text-red-500" strokeWidth={3} />
                                            ) : (
                                                <HugeiconsIcon icon={PauseIcon} size={16} className="text-red-500" strokeWidth={3} />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => window.location.reload()}
                                            className="w-8 h-8 rounded-full border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
                                            title="Reset"
                                        >
                                            <HugeiconsIcon icon={RefreshIcon} size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </motion.div>

                    {/* Mechanical Label - Floating outside */}
                    <AnimatePresence>
                        {isHovered && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="absolute top-1/2 right-50 bottom-50 -translate-y-1/2 flex flex-col gap-1 items-start pointer-events-none"
                            >
                                <div className="h-px w-8 bg-white/20" />
                                <span className="text-[9px] font-mono text-white/40 uppercase writing-vertical-lr tracking-wider">
                                    SYS.ACTV
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
