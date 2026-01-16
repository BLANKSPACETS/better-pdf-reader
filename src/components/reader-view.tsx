"use client";

import { useState } from "react";
import { usePdf } from "@/components/providers/pdf-provider";
import { PdfViewer } from "@/components/pdf-viewer";
import { ThemeToggle } from "@/components/theme-toggle";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Copy01Icon,
    FileScriptIcon,
    Menu01Icon,
    CheckmarkCircle02Icon,
    Brain01Icon,
    GridViewIcon,
    CommandIcon,
    MoreVerticalIcon,
    ChartHistogramIcon,
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

interface ReaderViewProps {
    onMenuClick?: () => void;
    onShowStats?: () => void;
}

export function ReaderView({ onMenuClick, onShowStats }: ReaderViewProps) {
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
        return (
            <div className="flex-1 flex items-center justify-center bg-background">
                <div className="text-center space-y-6">
                    {/* Editorial empty state */}
                    <div className="space-y-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            [DOCUMENT VIEWER]
                        </span>
                        <h2 className="text-3xl font-semibold text-foreground tracking-tight">
                            No document open
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                            Select a document from the library to begin reading
                        </p>
                    </div>
                    <div className="w-16 h-px bg-border mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background min-h-0">
            {/* Header - Editorial style */}
            <header className="shrink-0 h-14 border-b border-border bg-background flex items-center justify-between px-4 gap-4">
                {/* Left: Menu & Title */}
                <div className="flex items-center gap-2 min-w-0">
                    {/* Back to library (Close Document) */}
                    <button
                        onClick={closeDocument}
                        className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title="Go back to library"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={1.5} />
                    </button>

                    <div className="w-px h-4 bg-border mx-1" />

                    <button
                        onClick={onMenuClick}
                        className="lg:hidden w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors"
                        aria-label="Open menu"
                    >
                        <HugeiconsIcon icon={Menu01Icon} size={18} strokeWidth={1.5} className="text-foreground" />
                    </button>

                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="font-medium text-foreground truncate text-sm">
                                {currentDocument.name}
                            </h1>
                            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                                PDF
                            </span>
                        </div>
                    </div>
                </div>

                {/* Center: Navigation */}
                <div className="flex items-center gap-1 border border-border px-1 py-1">
                    <button
                        onClick={prevPage}
                        disabled={currentPage <= 1}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        aria-label="Previous page"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} className="text-foreground" />
                    </button>

                    <div className="flex items-center gap-1.5 px-2">
                        <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) goToPage(val);
                            }}
                            className="w-10 h-6 text-center text-xs font-mono bg-secondary border-0 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <span className="text-xs text-muted-foreground font-mono">/</span>
                        <span className="text-xs text-muted-foreground font-mono">{totalPages}</span>
                    </div>

                    <button
                        onClick={nextPage}
                        disabled={currentPage >= totalPages}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        aria-label="Next page"
                    >
                        <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} className="text-foreground" />
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* Stats Button */}
                    <button
                        onClick={onShowStats}
                        className="w-8 h-8 flex items-center justify-center border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title="Reading Stats"
                    >
                        <HugeiconsIcon icon={ChartHistogramIcon} size={14} strokeWidth={2} />
                    </button>

                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Copy Markdown Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className={`
                                flex items-center gap-2 px-3 h-8 border transition-all text-xs font-medium
                                ${copyState === "copied"
                                    ? "bg-foreground text-background border-foreground"
                                    : "border-border hover:bg-secondary text-foreground"
                                }
                            `}
                            disabled={copyState === "copying"}
                        >
                            {copyState === "copied" ? (
                                <>
                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2} />
                                    <span>Copied</span>
                                </>
                            ) : copyState === "copying" ? (
                                <>
                                    <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                    <span>Copying</span>
                                </>
                            ) : (
                                <>
                                    <HugeiconsIcon icon={CommandIcon} size={14} strokeWidth={2} />
                                    <span className="hidden sm:inline">Export MD</span>
                                </>
                            )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={8}>
                            <div className="px-3 py-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">Export</div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleCopy("page")}>
                                <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={2} />
                                Current Page
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopy("document")}>
                                <HugeiconsIcon icon={FileScriptIcon} size={14} strokeWidth={2} />
                                Entire Document
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Page Layout Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className="flex items-center gap-2 px-3 h-8 border border-border hover:bg-secondary text-foreground transition-all text-xs font-medium"
                            aria-label="Page layout"
                        >
                            <HugeiconsIcon icon={GridViewIcon} size={14} strokeWidth={2} />
                            <span className="hidden sm:inline font-mono">{pagesPerView}×</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={8}>
                            <div className="px-3 py-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">Layout</div>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup
                                value={String(pagesPerView)}
                                onValueChange={(v) => setPagesPerView(Number(v) as PagesPerView)}
                            >
                                <DropdownMenuRadioItem value="1">
                                    Single Page
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="2">
                                    Two Pages
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="4">
                                    Four Pages
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* More menu with theme */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className="w-8 h-8 flex items-center justify-center border border-border hover:bg-secondary transition-colors"
                            aria-label="More options"
                        >
                            <HugeiconsIcon icon={MoreVerticalIcon} size={14} strokeWidth={2} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={8}>
                            <div className="px-3 py-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">Theme</div>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-2">
                                <ThemeToggle />
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={closeDocument}
                            >
                                Close Document
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
