"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePdf } from "@/components/providers/pdf-provider";
// Dynamically import PdfViewer to avoid server-side usage of browser-only APIs (DOMMatrix)
const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then(mod => mod.PdfViewer), {
    ssr: false,
    loading: () => <div className="flex-1 bg-muted/20 animate-pulse" />
});
import { ThemeToggle } from "@/components/theme-toggle";
import { WeeklyBarChart } from "@/components/weekly-bar-chart";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Copy01Icon,
    FileScriptIcon,
    Menu01Icon,
    CheckmarkCircle02Icon,
    GridViewIcon,
    CommandIcon,
    MoreVerticalIcon,
    ChartHistogramIcon,
    NewTwitterIcon,
    Linkedin02Icon,
    Github01Icon,
    Share01Icon,
} from "@hugeicons/core-free-icons";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import type { PagesPerView } from "@/components/pdf-viewer";
import type { ReadingSession, AnalyticsDashboard } from "@/hooks/use-reading-stats";

interface ReaderViewProps {
    onMenuClick?: () => void;
    onShowStats?: () => void;
    currentStats?: ReadingSession;
    dashboard?: AnalyticsDashboard;
}

export function ReaderView({ onMenuClick, onShowStats, currentStats, dashboard }: ReaderViewProps) {
    // State for live stats updates
    const [elapsed, setElapsed] = useState(0);

    // Use dashboard weekly data if available, otherwise default
    const weeklyData = dashboard?.weeklyData ?? [0, 0, 0, 0, 0, 0, 0];
    const maxVal = Math.max(...weeklyData, 1); // Avoid division by zero

    const [todayIdx, setTodayIdx] = useState<number>(-1);
    useEffect(() => {
        // Compute today index (0 = Monday, 6 = Sunday) on client only
        const day = new Date().getDay();
        const idx = day === 0 ? 6 : day - 1;
        setTodayIdx(idx);
    }, []);

    // Format lifetime reading time
    const formatLifetimeTime = (ms: number) => {
        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m`;
        return "0m";
    };

    // Update elapsed time for stats display
    useEffect(() => {
        if (!currentStats) return;
        const update = () => {
            const val = typeof currentStats.totalDuration === "function"
                ? currentStats.totalDuration()
                : currentStats.totalDuration;
            setElapsed(val);
        };

        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [currentStats]);
    const {
        currentDocument,
        currentPdf,
        currentPage,
        totalPages,
        pagesPerView,
        goToPage,
        nextPage,
        prevPage,
        setPagesPerView,
        copyPageAsMarkdown,
        copyDocumentAsMarkdown,
        closeDocument,
    } = usePdf();

    const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");
    const [pageInputValue, setPageInputValue] = useState(String(currentPage));


    // Use focus state to prevent overwriting input while user is typing
    const [isInputFocused, setIsInputFocused] = useState(false);

    // Sync input value when page changes externally, ONLY if not focused
    useEffect(() => {
        if (!isInputFocused) {
            setPageInputValue(String(currentPage));
        }
    }, [currentPage, isInputFocused]);

    const handlePageSubmit = () => {
        let val = parseInt(pageInputValue);
        if (isNaN(val)) {
            val = currentPage;
        }

        // Clamp to bounds
        if (val < 1) val = 1;
        if (val > totalPages) val = totalPages;

        if (val !== currentPage) {
            goToPage(val);
        } else {
            // Just normalize the input display if it was weird (like "001" or "0")
            setPageInputValue(String(val));
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only allow digits
        const newValue = e.target.value.replace(/[^0-9]/g, '');
        setPageInputValue(newValue);
    };

    const handleCopy = async (type: "page" | "document") => {
        setCopyState("copying");
        try {
            if (type === "page") {
                await copyPageAsMarkdown();
            } else {
                await copyDocumentAsMarkdown();
            }
            setCopyState("copied");
            setTimeout(() => setCopyState("idle"), 2000);
        } catch (e) {
            console.error("Copy failed:", e);
            setCopyState("idle");
        }
    };

    if (!currentPdf || !currentDocument) {
        const totalTime = dashboard?.totalLifetimeReadingMs ?? 0;
        const totalPages = dashboard?.totalLifetimePagesRead ?? 0;
        const totalSessions = dashboard?.totalLifetimeSessions ?? 0;
        const streak = dashboard?.currentStreak ?? 0;
        const hasData = weeklyData.some(v => v > 0);
        const peakMinutes = Math.max(...weeklyData);

        return (
            <div className="flex-1 flex flex-col bg-background text-foreground relative overflow-hidden transition-colors duration-300">
                {/* Vertical Grid Lines Background */}
                <div className="absolute inset-0 pointer-events-none">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-foreground/5 dark:bg-white/[0.04]"
                            style={{ left: `${((i + 1) / 13) * 100}%` }}
                        />
                    ))}
                </div>

                {/* Radial Clock Decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] dark:opacity-[0.03]">
                    <svg width="800" height="800" viewBox="0 0 800 800">
                        <circle cx="400" cy="400" r="350" fill="none" stroke="currentColor" strokeWidth="1" />
                        <circle cx="400" cy="400" r="300" fill="none" stroke="currentColor" strokeWidth="0.5" />
                        {/* Generate tick lines with rounded integer coordinates to avoid hydration mismatch */}
                        {[...Array(60)].map((_, i) => {
                            const angle = (i * 6 - 90) * (Math.PI / 180);
                            const isMajor = i % 5 === 0;
                            const innerR = isMajor ? 320 : 340;
                            const outerR = 350;
                            const x1 = Math.round(400 + innerR * Math.cos(angle));
                            const y1 = Math.round(400 + innerR * Math.sin(angle));
                            const x2 = Math.round(400 + outerR * Math.cos(angle));
                            const y2 = Math.round(400 + outerR * Math.sin(angle));
                            return (
                                <line
                                    key={i}
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke="currentColor"
                                    strokeWidth={isMajor ? "2" : "0.5"}
                                />
                            );
                        })}
                    </svg>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col z-10">
                    {/* Header */}
                    <header className="shrink-0 flex items-center justify-between px-8 py-6">
                        <div className="flex items-center gap-4">
                            {/* Barcode decoration */}
                            <div className="flex gap-[2px] h-8">
                                {[2, 3, 2, 8, 0, 9, 0, 1, 0, 2, 0, 6].map((w, i) => (
                                    <div key={i} className="bg-foreground h-full" style={{ width: `${w * 2}px` }} />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            <span>Better PDF Reader</span>
                            <span className="text-foreground/20">—</span>
                            <span>v1.0</span>
                        </div>
                    </header>

                    {/* Boxy Bento Grid Container */}
                    <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center">
                        <div className="w-full max-w-[1400px] border border-border bg-border gap-px grid grid-cols-1 md:grid-cols-12 overflow-hidden shadow-2xl">

                            {/* Intro Section - 4 Cols */}
                            <div className="col-span-1 md:col-span-12 lg:col-span-4 bg-background p-8 flex flex-col justify-between min-h-[300px]">
                                <div>
                                    <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6 leading-tight">
                                        Better PDF<br />Reader
                                    </h1>
                                    <div className="space-y-2 text-sm text-muted-foreground font-mono">
                                        <p>Minimal reading environment.</p>
                                        <p>Intelligent analytics.</p>
                                        <p>No distractions.</p>
                                    </div>
                                </div>
                                {/* <div className="flex gap-3 mt-8">
                                    <a
                                        href="https://github.com/kiritocode1/better-pdf-reader"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-14 w-14 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors hover:scale-105 active:scale-95"
                                        title="GitHub"
                                    >
                                        <HugeiconsIcon icon={Github01Icon} size={24} />
                                    </a>
                                    <button
                                        onClick={() => {
                                            const text = "Check out Better PDF Reader by @kiritocode1";
                                            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                                        }}
                                        className="h-14 w-14 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors hover:scale-105 active:scale-95"
                                        title="Share on X"
                                    >
                                        <HugeiconsIcon icon={NewTwitterIcon} size={24} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank');
                                        }}
                                        className="h-14 w-14 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors hover:scale-105 active:scale-95"
                                        title="Share on LinkedIn"
                                    >
                                        <HugeiconsIcon icon={Linkedin02Icon} size={24} />
                                    </button>
                                </div> */}
                            </div>

                            {/* Right Side - 8 Cols */}
                            <div className="col-span-1 md:col-span-12 lg:col-span-8 grid grid-rows-[auto_1fr]">
                                {/* Top Row - Stats - Grid of 4 */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                                    <div className="bg-background p-6 flex flex-col justify-between aspect-[4/3]">
                                        <div className="text-[10px] uppercase text-muted-foreground tracking-widest font-mono">Total Time</div>
                                        <div className="text-2xl font-bold tracking-tight">{formatLifetimeTime(totalTime)}</div>
                                    </div>
                                    <div className="bg-background p-6 flex flex-col justify-between aspect-[4/3]">
                                        <div className="text-[10px] uppercase text-muted-foreground tracking-widest font-mono">Pages</div>
                                        <div className="text-2xl font-bold tracking-tight">{totalPages}</div>
                                    </div>
                                    <div className="bg-background p-6 flex flex-col justify-between aspect-[4/3]">
                                        <div className="text-[10px] uppercase text-muted-foreground tracking-widest font-mono">Sessions</div>
                                        <div className="text-2xl font-bold tracking-tight">{totalSessions}</div>
                                    </div>
                                    <div className="bg-background p-6 flex flex-col justify-between aspect-[4/3]">
                                        <div className="text-[10px] uppercase text-muted-foreground tracking-widest font-mono">Streak</div>
                                        <div className="text-2xl font-bold tracking-tight">{streak}<span className="text-sm font-normal text-muted-foreground ml-1">d</span></div>
                                    </div>
                                </div>

                                {/* Bottom Row - Weekly Chart */}
                                <div className="bg-background p-6 flex flex-col gap-px border-t border-border">
                                    <div className="text-[10px] uppercase text-muted-foreground tracking-widest mb-4 font-mono">Weekly Activity</div>
                                    <div className="flex-1 flex items-end min-h-[120px]">
                                        <WeeklyBarChart data={weeklyData} className="w-full" />
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Row - 3 Equal Square Blocks (4 cols each) */}
                            <div className="col-span-1 md:col-span-12 grid grid-cols-1 md:grid-cols-12 bg-background border-t border-border">

                                {/* Block 1: Details (4 Cols) */}
                                <div className="col-span-1 md:col-span-4 aspect-square p-8 flex flex-col justify-between bg-background border-r border-border">
                                    <div>
                                        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-mono mb-6">
                                            The Poetics of Space
                                        </div>
                                        <h3 className="text-3xl font-bold tracking-tight mb-4 leading-tight">
                                            A Digital<br />Sanctuary
                                        </h3>
                                    </div>
                                    <div className="text-sm text-muted-foreground font-mono leading-relaxed">
                                        Designed for those who view reading not just as consumption, but as an act of habitation.
                                    </div>
                                </div>

                                {/* Block 2: Social Grid (4 Cols) - 2x2 Boxy Grid */}
                                <div className="col-span-1 md:col-span-4 aspect-square bg-border gap-px grid grid-cols-2 grid-rows-2 border-r border-border">
                                    <a
                                        href="https://github.com/kiritocode1/better-pdf-reader"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-background hover:bg-red-600 hover:text-white flex flex-col items-center justify-center gap-2 group transition-colors"
                                        title="GitHub"
                                    >
                                        <HugeiconsIcon icon={Github01Icon} size={32} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] uppercase tracking-widest font-mono">GitHub</span>
                                    </a>
                                    <button
                                        onClick={() => {
                                            const text = "Check out Better PDF Reader by @kiritocode1";
                                            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                                        }}
                                        className="bg-background hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black flex flex-col items-center justify-center gap-2 group transition-colors"
                                        title="Share on X"
                                    >
                                        <HugeiconsIcon icon={NewTwitterIcon} size={32} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] uppercase tracking-widest font-mono">Share on X</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, '_blank');
                                        }}
                                        className="bg-background hover:bg-[#0077b5] hover:text-white flex flex-col items-center justify-center gap-2 group transition-colors"
                                        title="Share on LinkedIn"
                                    >
                                        <HugeiconsIcon icon={Linkedin02Icon} size={32} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] uppercase tracking-widest font-mono">LinkedIn</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(window.location.href);
                                            // Optional: You could trigger a toast here if available, but keeping it simple for now
                                        }}
                                        className="bg-background hover:bg-emerald-600 hover:text-white flex flex-col items-center justify-center gap-2 group transition-colors"
                                        title="Copy Link"
                                    >
                                        <HugeiconsIcon icon={Share01Icon} size={32} className="group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] uppercase tracking-widest font-mono">Copy Link</span>
                                    </button>
                                </div>

                                {/* Block 3: Square Image (4 Cols) */}
                                <div className="col-span-1 md:col-span-4 aspect-square bg-black relative group overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="/pixelated.png"
                                        alt="Abstract visuals"
                                        className="w-full h-full object-cover grayscale-0 opacity-60 group-hover:opacity-100 group-hover:grayscale transition-all duration-700 ease-in-out scale-105 group-hover:scale-100"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                                    {/* <div className="absolute bottom-6 right-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out">
                                        <HugeiconsIcon icon={ArrowRight01Icon} size={24} className="text-white" />
                                    </div> */}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <footer className="shrink-0 px-8 py-6 flex items-end justify-between">
                        <div className="flex items-center gap-8">
                            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                Project by
                            </div>
                            <a
                                href="https://aryank.space"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-bold tracking-tight hover:text-red-500 transition-colors"
                            >
                                BLANK
                            </a>
                        </div>

                        <div className="flex items-center gap-12">
                            <button
                                onClick={onShowStats}
                                className="group flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <span>View Full Analytics</span>
                                <HugeiconsIcon icon={ArrowRight01Icon} size={12} className="group-hover:translate-x-1 transition-transform" />
                            </button>

                            <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                <span>Local Storage</span>
                                <span>•</span>
                                <span>Privacy First</span>
                            </div>
                        </div>
                    </footer>
                </div>

                {/* Corner Accents */}
                <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-foreground/10 dark:border-white/10" />
                <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-foreground/10 dark:border-white/10" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-foreground/10 dark:border-white/10" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-foreground/10 dark:border-white/10" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background min-h-0 relative">
            {/* Header */}
            <header className="shrink-0 h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 gap-4 z-20">
                {/* Left: Menu & Title */}
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={closeDocument}
                        className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground border border-transparent hover:border-border rounded-sm"
                        title="Close Document"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
                    </button>

                    <div className="w-px h-4 bg-border mx-1" />

                    <button
                        onClick={onMenuClick}
                        className="lg:hidden w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors text-foreground"
                        aria-label="Open menu"
                    >
                        <HugeiconsIcon icon={Menu01Icon} size={18} />
                    </button>

                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="font-mono font-bold text-foreground truncate text-sm tracking-tight uppercase">
                                {currentDocument.name.length > 30 ? currentDocument.name.slice(0, 30) + "..." : currentDocument.name}
                            </h1>
                            <span className="font-mono text-[9px] text-red-500 uppercase tracking-wider border border-red-500/20 bg-red-500/10 px-1 py-0.5 rounded-[2px]">
                                PDF
                            </span>
                        </div>
                    </div>
                </div>

                {/* Center: Navigation */}
                <div className="flex items-center gap-1 border border-border px-1 py-1 rounded-[4px] bg-secondary/30">
                    <button
                        onClick={prevPage}
                        disabled={currentPage <= 1}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-foreground"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                    </button>

                    <div className="flex items-center gap-1.5 px-2 font-mono text-xs">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={pageInputValue}
                            onChange={handleInputChange}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => {
                                setIsInputFocused(false);
                                handlePageSubmit();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handlePageSubmit();
                            }}
                            className="w-10 h-6 text-center bg-transparent border-b border-border focus:border-red-500 focus:outline-none text-foreground transition-colors"
                        />
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">{totalPages}</span>
                    </div>

                    <button
                        onClick={nextPage}
                        disabled={currentPage >= totalPages}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-foreground"
                    >
                        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onShowStats}
                        className="w-8 h-8 flex items-center justify-center border border-border hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 transition-all text-muted-foreground"
                        title="Reading Stats"
                    >
                        <HugeiconsIcon icon={ChartHistogramIcon} size={14} />
                    </button>

                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Copy Markdown Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className={`
                                flex items-center gap-2 px-3 h-8 border transition-all text-xs font-mono uppercase tracking-wide
                                ${copyState === "copied"
                                    ? "bg-foreground text-background border-foreground"
                                    : "border-border hover:bg-secondary text-foreground"
                                }
                            `}
                            disabled={copyState === "copying"}
                        >
                            {copyState === "copied" ? (
                                <>
                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                                    <span>Copied</span>
                                </>
                            ) : copyState === "copying" ? (
                                <>
                                    <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                    <span>...</span>
                                </>
                            ) : (
                                <>
                                    <HugeiconsIcon icon={CommandIcon} size={14} />
                                    <span className="hidden sm:inline">Export</span>
                                </>
                            )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground font-mono">
                            <div className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-widest">Export_Mode</div>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem onClick={() => handleCopy("page")} className="focus:bg-secondary focus:text-foreground">
                                <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-2" />
                                Current_Page
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopy("document")} className="focus:bg-secondary focus:text-foreground">
                                <HugeiconsIcon icon={FileScriptIcon} size={14} className="mr-2" />
                                Full_Document
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Page Layout Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className="flex items-center gap-2 px-3 h-8 border border-border hover:bg-secondary text-foreground transition-all text-xs font-mono uppercase"
                        >
                            <HugeiconsIcon icon={GridViewIcon} size={14} />
                            <span className="hidden sm:inline">{pagesPerView}X</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground font-mono">
                            <DropdownMenuRadioGroup
                                value={String(pagesPerView)}
                                onValueChange={(v) => setPagesPerView(Number(v) as PagesPerView)}
                            >
                                <DropdownMenuRadioItem value="1" className="focus:bg-secondary focus:text-foreground text-xs">Single_View</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="2" className="focus:bg-secondary focus:text-foreground text-xs">Dual_View</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="4" className="focus:bg-secondary focus:text-foreground text-xs">Quad_View</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* More menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className="w-8 h-8 flex items-center justify-center border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <HugeiconsIcon icon={MoreVerticalIcon} size={14} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground font-mono">
                            <DropdownMenuItem
                                className="focus:bg-red-500 focus:text-white text-red-500 text-xs uppercase"
                                onClick={closeDocument}
                            >
                                Close_Document
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* PDF Viewer */}
            <PdfViewer pdf={currentPdf} currentPage={currentPage} pagesPerView={pagesPerView} onPageChange={goToPage} />
        </div>
    );
}
