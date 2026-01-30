"use client";

import { useCallback, useRef, useState } from "react";
import { usePdf } from "@/components/providers/pdf-provider";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Upload04Icon,
    Delete02Icon,
    FileIcon,
    MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LiveSessionStats } from "@/hooks/use-reading-stats";

interface LibrarySidebarProps {
    onDocumentOpen?: () => void;
    currentStats?: LiveSessionStats;
}

export function LibrarySidebar({ onDocumentOpen }: LibrarySidebarProps) {
    const {
        documents,
        currentDocument,
        isLoading,
        uploadDocument,
        openDocument,
        deleteDocument,
    } = usePdf();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
            if (file.type === "application/pdf") {
                await uploadDocument(file);
            }
        }
    }, [uploadDocument]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleUpload(e.dataTransfer.files);
    }, [handleUpload]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <aside className="w-80 h-full border-r border-sidebar-border bg-sidebar flex flex-col font-mono relative overflow-hidden text-sidebar-foreground">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.03] pointer-events-none" />

            {/* Header */}
            <div className="p-6 border-b border-sidebar-border z-10 bg-sidebar/80 backdrop-blur-sm">
                <div className="flex flex-col gap-4">
                    <div className="w-12 h-12 text-sidebar-foreground">
                        <svg viewBox="0 0 125 125" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                            <path d="M124 1V124H1V1H124Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
                            <path d="M62.5001 0V124.896" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
                            <path d="M124.896 62.5H62.5001" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
                            <path d="M93.6981 0V62.5" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
                            <path d="M124.896 31.198H93.6981" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
                            <path d="M109.297 0V31.198" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
                            <path d="M124.896 15.599H109.297" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
                            <path d="M117.097 0V15.599" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
                            <path d="M124.896 7.7995H117.097" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tighter leading-none mb-1">
                            BETTER PDF<br />READER
                        </h1>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest">
                            <span>Library</span>
                            <span className="w-px h-2 bg-sidebar-border" />
                            <span>{documents.length} Docs</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Area */}
            <div className="p-4 z-10">
                <div
                    className={`
                        relative p-6 border border-dashed transition-all cursor-pointer group
                        ${dragOver
                            ? "border-red-500 bg-red-500/10 text-red-500"
                            : "border-sidebar-border hover:border-sidebar-foreground/40 hover:bg-sidebar-accent text-sidebar-foreground"
                        }
                    `}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        multiple
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className={`
                            w-10 h-10 border border-sidebar-border flex items-center justify-center transition-colors
                            ${dragOver ? "bg-red-500 text-white border-transparent" : "text-muted-foreground group-hover:text-sidebar-foreground"}
                        `}>
                            <HugeiconsIcon
                                icon={Upload04Icon}
                                size={20}
                                strokeWidth={1.5}
                            />
                        </div>
                        <div>
                            <p className="text-xs font-medium tracking-wide uppercase">
                                Upload PDF
                            </p>
                            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">
                                Drag & Drop or Click
                            </p>
                        </div>
                    </div>

                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-sidebar-foreground/20 transition-colors group-hover:border-red-500" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-sidebar-foreground/20 transition-colors group-hover:border-red-500" />
                </div>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-auto px-4 pb-4 z-10">
                <div className="flex items-center justify-between mb-4 mt-2">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
                        Files_Index
                    </span>
                    <div className="flex-1 h-px bg-sidebar-border ml-4" />
                </div>

                {isLoading && documents.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-5 h-5 border-2 border-sidebar-border border-t-red-500 rounded-full animate-spin" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-12 space-y-2 opacity-30 text-muted-foreground">
                        <p className="text-xs uppercase tracking-widest">No Data</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {documents
                            .sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime())
                            .map((doc) => {
                                const isActive = currentDocument?.id === doc.id;
                                const progress = doc.totalPages > 1
                                    ? Math.round((doc.currentPage / doc.totalPages) * 100)
                                    : 100;

                                return (
                                    <div
                                        key={doc.id}
                                        className={`
                                            group relative p-3 cursor-pointer transition-all border border-transparent
                                            ${isActive
                                                ? "bg-sidebar-accent border-sidebar-border"
                                                : "hover:bg-sidebar-accent/50 hover:border-sidebar-border/50"
                                            }
                                        `}
                                        onClick={() => {
                                            openDocument(doc.id);
                                            onDocumentOpen?.();
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Minimalist Progress Icon */}
                                            <div className="relative w-8 h-8 flex items-center justify-center shrink-0 border border-sidebar-border bg-sidebar">
                                                {isActive && (
                                                    <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500" />
                                                )}
                                                <span className="text-[9px] font-bold text-muted-foreground">{progress}%</span>
                                            </div>

                                            <div className="flex-1 min-w-0 space-y-1">
                                                <p className={`text-xs truncate leading-tight transition-colors ${isActive ? "text-sidebar-foreground font-medium" : "text-muted-foreground group-hover:text-sidebar-foreground"}`}>
                                                    {doc.name.length > 30 ? doc.name.slice(0, 30) + "..." : doc.name}
                                                </p>
                                                <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                                                    <span>{doc.totalPages} PG</span>
                                                    <span className="w-px h-2 bg-sidebar-border" />
                                                    <span>{formatDate(new Date(doc.lastOpenedAt))}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger
                                                    className={`
                                                        w-6 h-6 flex items-center justify-center
                                                        opacity-0 group-hover:opacity-100 transition-opacity
                                                        text-muted-foreground hover:text-sidebar-foreground
                                                    `}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <HugeiconsIcon icon={MoreHorizontalIcon} size={14} />
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground font-mono">
                                                    <DropdownMenuItem
                                                        className="focus:bg-red-500 focus:text-white text-red-500 text-xs uppercase tracking-wide"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteDocument(doc.id);
                                                        }}
                                                    >
                                                        <HugeiconsIcon icon={Delete02Icon} size={14} className="mr-2" />
                                                        Delete_File
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-sidebar-border z-10 bg-sidebar">
                <a
                    href="https://aryank.space"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-mono text-[9px] text-muted-foreground hover:text-red-500 uppercase tracking-[0.15em] text-center transition-colors"
                >
                    Better PDF Reader by BLANK
                </a>
            </div>
        </aside>
    );
}
