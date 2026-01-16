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
} from "@hugeicons/core-free-icons";

interface ReaderViewProps {
    onMenuClick?: () => void;
}

export function ReaderView({ onMenuClick }: ReaderViewProps) {
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
    const [copyType, setCopyType] = useState<"page" | "document">("page");

    const handleCopy = async (type: "page" | "document") => {
        setCopyType(type);
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
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-secondary/50 flex items-center justify-center">
                        <HugeiconsIcon icon={FileScriptIcon} size={40} strokeWidth={1.5} className="text-muted-foreground" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">No document open</h2>
                        <p className="text-sm text-muted-foreground mt-1">Select a document from the library to start reading</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background min-h-0">
            {/* Header */}
            <header className="shrink-0 h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 gap-4">
                {/* Left: Menu & Title */}
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
                        aria-label="Open menu"
                    >
                        <HugeiconsIcon icon={Menu01Icon} size={20} strokeWidth={2} className="text-foreground" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="font-semibold text-foreground truncate">{currentDocument.name}</h1>
                        <p className="text-xs text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </p>
                    </div>
                </div>

                {/* Center: Navigation */}
                <div className="flex items-center gap-2 bg-secondary/50 rounded-2xl p-1.5 border border-border">
                    <button
                        onClick={prevPage}
                        disabled={currentPage <= 1}
                        className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Previous page"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={2} className="text-foreground" />
                    </button>

                    <div className="flex items-center gap-1 px-2">
                        <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) goToPage(val);
                            }}
                            className="w-12 h-8 text-center text-sm font-medium bg-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <span className="text-sm text-muted-foreground">/ {totalPages}</span>
                    </div>

                    <button
                        onClick={nextPage}
                        disabled={currentPage >= totalPages}
                        className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Next page"
                    >
                        <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2} className="text-foreground" />
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* Copy Markdown Dropdown */}
                    <div className="relative group">
                        <button
                            className={`
                flex items-center gap-2 px-4 h-10 rounded-xl border transition-all
                ${copyState === "copied"
                                    ? "bg-green-500/10 border-green-500/30 text-green-600"
                                    : "bg-secondary/50 border-border hover:bg-secondary text-foreground"
                                }
              `}
                            onClick={() => handleCopy("page")}
                            disabled={copyState === "copying"}
                        >
                            {copyState === "copied" ? (
                                <>
                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={2} />
                                    <span className="text-sm font-medium">Copied!</span>
                                </>
                            ) : copyState === "copying" ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm font-medium">Copying...</span>
                                </>
                            ) : (
                                <>
                                    <HugeiconsIcon icon={Brain01Icon} size={16} strokeWidth={2} />
                                    <span className="text-sm font-medium hidden sm:inline">Copy Page</span>
                                </>
                            )}
                        </button>

                        {/* Dropdown */}
                        <div className="
              absolute top-full right-0 mt-2 w-48 py-2
              bg-popover border border-border rounded-xl shadow-xl
              opacity-0 invisible group-hover:opacity-100 group-hover:visible
              transition-all duration-200 z-50
            ">
                            <button
                                onClick={() => handleCopy("page")}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                            >
                                <HugeiconsIcon icon={Copy01Icon} size={16} strokeWidth={2} />
                                Copy Current Page
                            </button>
                            <button
                                onClick={() => handleCopy("document")}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                            >
                                <HugeiconsIcon icon={FileScriptIcon} size={16} strokeWidth={2} />
                                Copy Entire Document
                            </button>
                        </div>
                    </div>

                    {/* Page Layout Selector */}
                    <div className="relative group">
                        <button
                            className="flex items-center gap-2 px-3 h-10 rounded-xl border bg-secondary/50 border-border hover:bg-secondary text-foreground transition-all"
                            aria-label="Page layout"
                        >
                            <HugeiconsIcon icon={GridViewIcon} size={16} strokeWidth={2} />
                            <span className="text-sm font-medium hidden sm:inline">{pagesPerView} Page{pagesPerView > 1 ? 's' : ''}</span>
                        </button>

                        {/* Dropdown */}
                        <div className="
                            absolute top-full right-0 mt-2 w-36 py-2
                            bg-popover border border-border rounded-xl shadow-xl
                            opacity-0 invisible group-hover:opacity-100 group-hover:visible
                            transition-all duration-200 z-50
                        ">
                            {([1, 2, 4] as const).map((count) => (
                                <button
                                    key={count}
                                    onClick={() => setPagesPerView(count)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                                        ${pagesPerView === count
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-foreground hover:bg-secondary'
                                        }
                                    `}
                                >
                                    {count} Page{count > 1 ? 's' : ''}
                                </button>
                            ))}
                        </div>
                    </div>

                    <ThemeToggle />
                </div>
            </header>

            {/* PDF Viewer */}
            <PdfViewer pdf={currentPdf} currentPage={currentPage} pagesPerView={pagesPerView} onPageChange={goToPage} />
        </div>
    );
}
