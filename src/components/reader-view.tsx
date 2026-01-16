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
            if (minutes > 0) return `${minutes}m`;
            return "0m";
        };

        const totalTime = dashboard?.totalLifetimeReadingMs ?? 0;
        const [todayIdx, setTodayIdx] = useState<number>(-1);
        useEffect(() => {
            // Compute today index (0 = Monday, 6 = Sunday) on client only
            const day = new Date().getDay();
            const idx = day === 0 ? 6 : day - 1;
            setTodayIdx(idx);
        }, []);
        const totalPages = dashboard?.totalLifetimePagesRead ?? 0;
        const totalSessions = dashboard?.totalLifetimeSessions ?? 0;
        const streak = dashboard?.currentStreak ?? 0;
        const hasData = weeklyData.some(v => v > 0);
        const peakMinutes = Math.max(...weeklyData);

        return (
            <div className="flex-1 flex flex-col bg-black text-white relative overflow-hidden">
                {/* Vertical Grid Lines Background */}
                <div className="absolute inset-0 pointer-events-none">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-white/[0.04]"
                            style={{ left: `${((i + 1) / 13) * 100}%` }}
                        />
                    ))}
                </div>

                {/* Radial Clock Decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03]">
                    <svg width="800" height="800" viewBox="0 0 800 800">
                        <circle cx="400" cy="400" r="350" fill="none" stroke="white" strokeWidth="1" />
                        <circle cx="400" cy="400" r="300" fill="none" stroke="white" strokeWidth="0.5" />
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
                                    stroke="white"
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
                                {[3, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 1].map((w, i) => (
                                    <div key={i} className="bg-white h-full" style={{ width: `${w * 2}px` }} />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-white/40">
                            <span>Better PDF Reader</span>
                            <span className="text-white/20">—</span>
                            <span>v1.0</span>
                        </div>
                    </header>

                    {/* Compact Grid Layout */}
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 p-4">
                        {/* Intro Card */}
                        <div className="col-span-2 md:col-span-3 lg:col-span-2 bg-background border border-border p-2 hover:bg-white/10 transition-colors">
                            <h1 className="text-2xl font-bold tracking-tighter mb-2">Better PDF Reader</h1>
                            <p className="text-sm text-muted-foreground">Minimal reading with analytics. No distractions.</p>
                        </div>
                        {/* Total Time */}
                        <div className="bg-background border border-border p-2 hover:bg-white/10 transition-colors">
                            <div className="text-xs uppercase text-muted-foreground mb-1">Total Time</div>
                            <div className="text-lg font-bold">{formatLifetimeTime(totalTime)}</div>
                        </div>
                        {/* Pages Read */}
                        <div className="bg-background border border-border p-2 hover:bg-white/10 transition-colors">
                            <div className="text-xs uppercase text-muted-foreground mb-1">Pages</div>
                            <div className="text-lg font-bold">{totalPages}</div>
                        </div>
                        {/* Sessions */}
                        <div className="bg-background border border-border p-2 hover:bg-white/10 transition-colors">
                            <div className="text-xs uppercase text-muted-foreground mb-1">Sessions</div>
                            <div className="text-lg font-bold">{totalSessions}</div>
                        </div>
                        {/* Streak */}
                        <div className="bg-background border border-border p-2 hover:bg-white/10 transition-colors">
                            <div className="text-xs uppercase text-muted-foreground mb-1">Streak</div>
                            <div className="text-lg font-bold">{streak}<span className="text-sm font-normal text-muted-foreground ml-1">d</span></div>
                        </div>
                        {/* Weekly Activity Chart */}
                        <div className="col-span-2 md:col-span-3 lg:col-span-2 bg-background border border-border p-3 hover:bg-white/5 transition-colors">
                            <div className="text-xs uppercase text-muted-foreground mb-3 tracking-wider">Weekly Activity</div>
                            <WeeklyBarChart data={weeklyData} />
                        </div>
                    </div>

                    {/* Footer */}
                    <footer className="shrink-0 px-8 py-6 flex items-end justify-between">
                        <div className="flex items-center gap-8">
                            <div className="text-[10px] uppercase tracking-[0.15em] text-white/30">
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
                                className="group flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
                            >
                                <span>View Full Analytics</span>
                                <HugeiconsIcon icon={ArrowRight01Icon} size={12} className="group-hover:translate-x-1 transition-transform" />
                            </button>

                            <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.15em] text-white/30">
                                <span>Local Storage</span>
                                <span>•</span>
                                <span>Privacy First</span>
                            </div>
                        </div>
                    </footer>
                </div>

                {/* Corner Accents */}
                <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-white/10" />
                <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-white/10" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-white/10" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-white/10" />
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
