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
    Clock01Icon,
    BookOpen01Icon,
    FlashIcon,
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
        // Format lifetime reading time
        const formatLifetimeTime = (ms: number) => {
            const totalMinutes = Math.floor(ms / 60000);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            if (hours > 0) return `${hours}h ${minutes}m`;
            return `${minutes}m`;
        };

        return (
            <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.03] pointer-events-none" />

                <div className="flex-1 flex flex-col items-center justify-center z-10 p-8">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-500">
                            System_Idle
                        </span>
                        <h2 className="text-3xl font-bold text-foreground tracking-tight uppercase mt-2">
                            Intelligence_Hub
                        </h2>
                        <p className="text-xs text-muted-foreground font-mono tracking-wide max-w-[320px] mx-auto mt-2">
                            SELECT A FILE FROM THE LIBRARY TO BEGIN READING
                        </p>
                    </div>

                    {/* Stats Dashboard - Lifetime Stats */}
                    <div className="w-full max-w-2xl space-y-6">
                        {/* Lifetime Stats Row */}
                        <div className="grid grid-cols-4 gap-4">
                            {/* Total Reading Time */}
                            <div className="p-5 border border-border bg-secondary/20 rounded-sm group hover:border-red-500/50 transition-all">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 border border-border rounded-full flex items-center justify-center group-hover:border-red-500 group-hover:text-red-500 transition-colors">
                                        <HugeiconsIcon icon={Clock01Icon} size={16} />
                                    </div>
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">Total Time</span>
                                </div>
                                <div className="text-xl font-mono font-bold text-foreground tracking-tight">
                                    {formatLifetimeTime(dashboard?.totalLifetimeReadingMs ?? 0)}
                                </div>
                            </div>

                            {/* Total Pages Read */}
                            <div className="p-5 border border-border bg-secondary/20 rounded-sm group hover:border-red-500/50 transition-all">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 border border-border rounded-full flex items-center justify-center group-hover:border-red-500 group-hover:text-red-500 transition-colors">
                                        <HugeiconsIcon icon={BookOpen01Icon} size={16} />
                                    </div>
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">Pages</span>
                                </div>
                                <div className="text-xl font-mono font-bold text-foreground tracking-tight">
                                    {dashboard?.totalLifetimePagesRead ?? 0}
                                </div>
                            </div>

                            {/* Total Sessions */}
                            <div className="p-5 border border-border bg-secondary/20 rounded-sm group hover:border-red-500/50 transition-all">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 border border-border rounded-full flex items-center justify-center group-hover:border-red-500 group-hover:text-red-500 transition-colors">
                                        <HugeiconsIcon icon={FlashIcon} size={16} />
                                    </div>
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">Sessions</span>
                                </div>
                                <div className="text-xl font-mono font-bold text-foreground tracking-tight">
                                    {dashboard?.totalLifetimeSessions ?? 0}
                                </div>
                            </div>

                            {/* Current Streak */}
                            <div className="p-5 border border-border bg-secondary/20 rounded-sm group hover:border-red-500/50 transition-all">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 border border-border rounded-full flex items-center justify-center group-hover:border-red-500 group-hover:text-red-500 transition-colors">
                                        <HugeiconsIcon icon={ChartHistogramIcon} size={16} />
                                    </div>
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">Streak</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-mono font-bold text-foreground tracking-tight">
                                        {dashboard?.currentStreak ?? 0}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground uppercase">days</span>
                                </div>
                            </div>
                        </div>

                        {/* Weekly Activity Chart */}
                        <div className="p-6 border border-border bg-secondary/10 rounded-sm">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-mono font-bold">Weekly_Activity</span>
                                <span className="text-[9px] text-muted-foreground font-mono">MINUTES READ</span>
                            </div>
                            <div className="h-24 flex items-end gap-3">
                                {weeklyData.map((val, i) => (
                                    <div key={i} className="flex-1 flex flex-col justify-end gap-1 group">
                                        <div
                                            className="w-full bg-foreground/20 group-hover:bg-red-500 transition-colors relative min-h-[4px] rounded-t-sm"
                                            style={{ height: `${(val / maxVal) * 100}%` }}
                                        >
                                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[9px] font-mono bg-foreground text-background px-1.5 py-0.5 rounded transform transition-all">
                                                {val}m
                                            </div>
                                        </div>
                                        <span className="text-[9px] text-center text-muted-foreground font-mono uppercase">
                                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center justify-center gap-4 pt-4">
                            <button
                                onClick={onShowStats}
                                className="flex items-center gap-2 px-4 py-2 border border-border hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 transition-all text-xs font-mono uppercase tracking-wide text-muted-foreground"
                            >
                                <HugeiconsIcon icon={ChartHistogramIcon} size={14} />
                                <span>View Full Stats</span>
                            </button>
                        </div>
                    </div>
                </div>
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
                                {currentDocument.name}
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
