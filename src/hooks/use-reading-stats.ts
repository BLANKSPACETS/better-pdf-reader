import { useState, useEffect, useRef } from "react";
import { usePdf } from "@/components/providers/pdf-provider";

export interface PageTime {
    page: number;
    duration: number; // in milliseconds
}

export interface ReadingSession {
    startTime: number;
    totalDuration: number | (() => number);
    pagesRead: number;
    averageTimePerPage: number;
    history: PageTime[];
}

export function useReadingStats() {
    const { currentDocument, currentPage } = usePdf();
    const [isOpen, setIsOpen] = useState(false);

    // Session state
    const [startTime, setStartTime] = useState<number>(Date.now());
    const [history, setHistory] = useState<PageTime[]>([]);

    // Refs for tracking intervals without re-renders
    const lastPageParams = useRef({ page: 1, time: Date.now() });

    // Reset on new document
    useEffect(() => {
        if (currentDocument) {
            setStartTime(Date.now());
            setHistory([]);
            lastPageParams.current = { page: currentPage, time: Date.now() };
        }
    }, [currentDocument?.id]);

    // Track page changes
    useEffect(() => {
        if (!currentDocument) return;

        const now = Date.now();
        const { page: lastPage, time: lastTime } = lastPageParams.current;
        const duration = now - lastTime;

        if (lastPage !== currentPage) {
            // Record history
            setHistory(prev => {
                const existingIndex = prev.findIndex(p => p.page === lastPage);

                if (existingIndex >= 0) {
                    const newHistory = [...prev];
                    const item = newHistory[existingIndex];
                    if (item) {
                        newHistory[existingIndex] = { ...item, duration: item.duration + duration };
                    }
                    return newHistory;
                }

                return [...prev, { page: lastPage, duration }];
            });

            // Update refs
            lastPageParams.current = { page: currentPage, time: now };
        }
    }, [currentPage, currentDocument]);

    // Live duration calculation helper
    const getSessionDuration = () => Date.now() - startTime;

    // Calculate derived stats
    const totalPagesRead = new Set(history.map(h => h.page)).size;
    const totalRecordedTime = history.reduce((acc, curr) => acc + curr.duration, 0);
    const avgTime = totalPagesRead > 0 ? totalRecordedTime / totalPagesRead : 0;

    return {
        isOpen,
        setIsOpen,
        stats: {
            startTime,
            totalDuration: getSessionDuration, // function to get live time
            pagesRead: totalPagesRead,
            averageTimePerPage: avgTime,
            history
        }
    };
}
