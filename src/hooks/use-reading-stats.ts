"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Effect, Layer } from "effect";
import { usePdf } from "@/components/providers/pdf-provider";
import {
    AnalyticsStorage,
    type ReadingSessionRecord,
    type DocumentStats,
    type DailyReadingSummary,
    type GlobalAnalytics,
    type PageReadingTime,
} from "@/lib/analytics-storage";

// ============================================================================
// Types
// ============================================================================

export interface PageTime {
    page: number;
    duration: number; // in milliseconds
}

export interface LiveSessionStats {
    startTime: number;
    totalDuration: number | (() => number);
    getCurrentPageDuration: () => number;
    pagesRead: number;
    averageTimePerPage: number;
    history: PageTime[];
    currentPage: number;
}

export interface AnalyticsDashboard {
    // Global stats
    totalLifetimeReadingMs: number;
    totalLifetimePagesRead: number;
    totalLifetimeSessions: number;
    longestSessionMs: number;
    currentStreak: number;
    longestStreak: number;

    // Weekly data (last 7 days, in minutes)
    weeklyData: number[];

    // Per-document stats
    documentStats: typeof DocumentStats.Type[];

    // Recent sessions
    recentSessions: typeof ReadingSessionRecord.Type[];
}

// ============================================================================
// Effect Layer for Analytics
// ============================================================================

const AnalyticsLayer = AnalyticsStorage.layer;

function runAnalyticsEffect<A, E>(effect: Effect.Effect<A, E, AnalyticsStorage>) {
    return Effect.runPromise(Effect.provide(effect, AnalyticsLayer));
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTodayString(): string {
    return new Date().toISOString().split("T")[0] ?? "";
}

function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useReadingAnalytics() {
    const { currentDocument, currentPage } = usePdf();

    // UI State
    const [isOpen, setIsOpen] = useState(false);
    const [isPaused, setIsPaused] = useState(true); // Start paused - only active when reading

    // Session State
    const [sessionId] = useState(() => generateSessionId());
    const [startTime, setStartTime] = useState<number>(Date.now());
    const [history, setHistory] = useState<PageTime[]>([]);

    // Analytics Dashboard State
    const [dashboard, setDashboard] = useState<AnalyticsDashboard>({
        totalLifetimeReadingMs: 0,
        totalLifetimePagesRead: 0,
        totalLifetimeSessions: 0,
        longestSessionMs: 0,
        currentStreak: 0,
        longestStreak: 0,
        weeklyData: [0, 0, 0, 0, 0, 0, 0],
        documentStats: [],
        recentSessions: [],
    });

    // Refs for tracking
    const pauseStartRef = useRef<number | null>(null);
    const lastPageParams = useRef({ page: 1, time: Date.now() });
    const accumulatedPauseTime = useRef(0);
    const currentDocumentIdRef = useRef<string | null>(null);

    // ========================================================================
    // Load Analytics Dashboard on Mount
    // ========================================================================
    const loadDashboard = useCallback(async () => {
        try {
            const [global, docStats, recentSessions] = await Promise.all([
                runAnalyticsEffect(
                    Effect.gen(function* () {
                        const storage = yield* AnalyticsStorage;
                        return yield* storage.getGlobalAnalytics();
                    })
                ),
                runAnalyticsEffect(
                    Effect.gen(function* () {
                        const storage = yield* AnalyticsStorage;
                        return yield* storage.getAllDocumentStats();
                    })
                ),
                runAnalyticsEffect(
                    Effect.gen(function* () {
                        const storage = yield* AnalyticsStorage;
                        return yield* storage.getRecentSessions(10);
                    })
                ),
            ]);

            setDashboard({
                totalLifetimeReadingMs: global.totalLifetimeReadingMs,
                totalLifetimePagesRead: global.totalLifetimePagesRead,
                totalLifetimeSessions: global.totalLifetimeSessions,
                longestSessionMs: global.longestSessionMs,
                currentStreak: global.currentStreak,
                longestStreak: global.longestStreak,
                weeklyData: [...global.weeklyData],
                documentStats: docStats,
                recentSessions: recentSessions,
            });
        } catch (error) {
            console.error("[Analytics] Failed to load dashboard:", error);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    // ========================================================================
    // Auto-Pause/Resume based on Document State
    // ========================================================================
    useEffect(() => {
        if (currentDocument) {
            // Document loaded - resume session if it was auto-paused
            if (currentDocumentIdRef.current !== currentDocument.id) {
                // New document - reset session
                console.log("[Analytics] New document opened, starting fresh session");
                currentDocumentIdRef.current = currentDocument.id;
                setStartTime(Date.now());
                setHistory([]);
                lastPageParams.current = { page: currentPage, time: Date.now() };
                accumulatedPauseTime.current = 0;
                pauseStartRef.current = null;
                setIsPaused(false); // Auto-start when document opens
            } else if (isPaused && pauseStartRef.current) {
                // Same document, unpause
                console.log("[Analytics] Document re-focused, resuming session");
                const pauseDuration = Date.now() - pauseStartRef.current;
                accumulatedPauseTime.current += pauseDuration;
                pauseStartRef.current = null;
                setIsPaused(false);
            }
        } else {
            // No document - pause if not already paused
            if (!isPaused) {
                console.log("[Analytics] No document loaded, pausing session");
                pauseStartRef.current = Date.now();
                setIsPaused(true);

                // Save current session state before pausing
                saveCurrentSession();
            }
        }
    }, [currentDocument?.id]);

    // ========================================================================
    // Track Page Changes
    // ========================================================================
    useEffect(() => {
        if (!currentDocument || isPaused) return;

        const now = Date.now();
        const { page: lastPage, time: lastTime } = lastPageParams.current;
        const duration = now - lastTime;

        if (lastPage !== currentPage) {
            // Record time on previous page if significant (> 2 seconds)
            if (duration > 2000) {
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
            }

            lastPageParams.current = { page: currentPage, time: now };
        }
    }, [currentPage, currentDocument, isPaused]);

    // ========================================================================
    // Duration Calculations
    // ========================================================================
    const getSessionDuration = useCallback(() => {
        if (isPaused && pauseStartRef.current) {
            return pauseStartRef.current - startTime - accumulatedPauseTime.current;
        }
        return Date.now() - startTime - accumulatedPauseTime.current;
    }, [isPaused, startTime]);

    const getCurrentPageDuration = useCallback(() => {
        if (isPaused && pauseStartRef.current) {
            return pauseStartRef.current - lastPageParams.current.time;
        }
        return Date.now() - lastPageParams.current.time;
    }, [isPaused]);

    // ========================================================================
    // Save Session to IndexedDB
    // ========================================================================
    const saveCurrentSession = useCallback(async () => {
        if (!currentDocumentIdRef.current) return;

        const sessionDuration = getSessionDuration();
        if (sessionDuration < 5000) return; // Don't save sessions shorter than 5 seconds

        // Include the current page's accumulated time
        const currentPageDuration = getCurrentPageDuration();
        const currentPageNum = lastPageParams.current.page;

        // Build complete history including current page
        const completeHistory: PageTime[] = [...history];
        if (currentPageDuration > 1000) {
            const existingIdx = completeHistory.findIndex(h => h.page === currentPageNum);
            if (existingIdx >= 0) {
                const item = completeHistory[existingIdx];
                if (item) {
                    completeHistory[existingIdx] = { ...item, duration: item.duration + currentPageDuration };
                }
            } else {
                completeHistory.push({ page: currentPageNum, duration: currentPageDuration });
            }
        }

        // If still no history, at least record we were on the page
        if (completeHistory.length === 0) {
            completeHistory.push({ page: currentPageNum, duration: sessionDuration });
        }

        const pageHistory: typeof PageReadingTime.Type[] = completeHistory.map(h => ({
            page: h.page,
            durationMs: h.duration,
            visitCount: 1,
        }));

        const pageDurations = completeHistory.map(h => h.duration);
        const totalPagesRead = new Set(completeHistory.map(h => h.page)).size;

        const session: typeof ReadingSessionRecord.Type = {
            id: sessionId,
            documentId: currentDocumentIdRef.current,
            startedAt: new Date(startTime),
            endedAt: new Date(),
            totalDurationMs: sessionDuration,
            pagesRead: totalPagesRead,
            pageHistory,
            avgTimePerPageMs: totalPagesRead > 0 ? sessionDuration / totalPagesRead : 0,
            fastestPageMs: pageDurations.length > 0 ? Math.min(...pageDurations) : 0,
            slowestPageMs: pageDurations.length > 0 ? Math.max(...pageDurations) : 0,
        };

        try {
            await runAnalyticsEffect(
                Effect.gen(function* () {
                    const storage = yield* AnalyticsStorage;

                    // Save session
                    yield* storage.saveSession(session);

                    // Update document stats
                    const existingStats = yield* storage.getDocumentStats(session.documentId);
                    const pageHeatmap: Record<string, number> = existingStats?.pageHeatmap ?? {};

                    // Merge page heatmap
                    for (const ph of pageHistory) {
                        const key = String(ph.page);
                        pageHeatmap[key] = (pageHeatmap[key] ?? 0) + ph.durationMs;
                    }

                    const updatedStats: typeof DocumentStats.Type = {
                        documentId: session.documentId,
                        documentName: currentDocument?.name ?? "Unknown",
                        totalReadingTimeMs: (existingStats?.totalReadingTimeMs ?? 0) + sessionDuration,
                        totalSessionCount: (existingStats?.totalSessionCount ?? 0) + 1,
                        totalPagesRead: (existingStats?.totalPagesRead ?? 0) + totalPagesRead,
                        uniquePagesRead: Object.keys(pageHeatmap).length,
                        avgSessionDurationMs: existingStats
                            ? ((existingStats.avgSessionDurationMs * existingStats.totalSessionCount) + sessionDuration) / (existingStats.totalSessionCount + 1)
                            : sessionDuration,
                        avgTimePerPageMs: existingStats
                            ? ((existingStats.avgTimePerPageMs * existingStats.totalPagesRead) + sessionDuration) / ((existingStats.totalPagesRead ?? 0) + totalPagesRead)
                            : session.avgTimePerPageMs,
                        lastReadAt: new Date(),
                        firstReadAt: existingStats?.firstReadAt ?? new Date(),
                        pageHeatmap,
                    };

                    yield* storage.updateDocumentStats(updatedStats);

                    // Update daily summary
                    const today = getTodayString();
                    const existingDaily = yield* storage.getDailySummary(today);

                    const updatedDaily: typeof DailyReadingSummary.Type = {
                        date: today,
                        totalReadingTimeMs: (existingDaily?.totalReadingTimeMs ?? 0) + sessionDuration,
                        totalPagesRead: (existingDaily?.totalPagesRead ?? 0) + totalPagesRead,
                        sessionCount: (existingDaily?.sessionCount ?? 0) + 1,
                        documentsRead: existingDaily
                            ? [...new Set([...existingDaily.documentsRead, session.documentId])]
                            : [session.documentId],
                    };

                    yield* storage.updateDailySummary(updatedDaily);

                    // Update global analytics
                    const global = yield* storage.getGlobalAnalytics();

                    // Calculate streak
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split("T")[0] ?? "";

                    let newCurrentStreak = global.currentStreak;
                    if (global.lastActiveDate === yesterdayStr) {
                        // Continuing streak
                        newCurrentStreak = global.currentStreak + 1;
                    } else if (global.lastActiveDate !== today) {
                        // Streak broken
                        newCurrentStreak = 1;
                    }

                    // Update weekly data
                    const weeklyData = [...global.weeklyData];
                    const dayOfWeek = new Date().getDay();
                    // Convert to M-T-W-T-F-S-S order (0=Monday)
                    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    weeklyData[adjustedDay] = (weeklyData[adjustedDay] ?? 0) + Math.round(sessionDuration / 60000);

                    const updatedGlobal: typeof GlobalAnalytics.Type = {
                        id: "global",
                        totalLifetimeReadingMs: global.totalLifetimeReadingMs + sessionDuration,
                        totalLifetimePagesRead: global.totalLifetimePagesRead + totalPagesRead,
                        totalLifetimeSessions: global.totalLifetimeSessions + 1,
                        avgReadingTimePerDayMs: global.avgReadingTimePerDayMs, // Could recalculate
                        avgPagesPerDay: global.avgPagesPerDay, // Could recalculate
                        longestSessionMs: Math.max(global.longestSessionMs, sessionDuration),
                        longestStreak: Math.max(global.longestStreak, newCurrentStreak),
                        currentStreak: newCurrentStreak,
                        lastActiveDate: today,
                        weeklyData,
                    };

                    yield* storage.updateGlobalAnalytics(updatedGlobal);

                    console.log("[Analytics] Session saved successfully");
                })
            );

            // Refresh dashboard
            loadDashboard();
        } catch (error) {
            console.error("[Analytics] Failed to save session:", error);
        }
    }, [sessionId, startTime, history, getSessionDuration, getCurrentPageDuration, currentDocument?.name, loadDashboard]);

    // ========================================================================
    // Manual Toggle Pause
    // ========================================================================
    const togglePause = useCallback(() => {
        if (isPaused) {
            // Unpause
            if (pauseStartRef.current) {
                const pauseDuration = Date.now() - pauseStartRef.current;
                accumulatedPauseTime.current += pauseDuration;
                lastPageParams.current.time += pauseDuration;
            }
            pauseStartRef.current = null;
            setIsPaused(false);
        } else {
            // Pause
            pauseStartRef.current = Date.now();
            setIsPaused(true);
            saveCurrentSession();
        }
    }, [isPaused, saveCurrentSession]);

    // ========================================================================
    // Idle Watchdog - Auto-pause after inactivity
    // ========================================================================
    useEffect(() => {
        if (isPaused || !currentDocument) return;

        let idleTimer: NodeJS.Timeout;
        const IDLE_TIMEOUT = 120000; // 2 minutes

        const resetIdleTimer = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                console.log("[Analytics] Auto-pausing due to inactivity");
                pauseStartRef.current = Date.now();
                setIsPaused(true);
                saveCurrentSession();
            }, IDLE_TIMEOUT);
        };

        const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
        const handleActivity = () => resetIdleTimer();

        events.forEach(event => window.addEventListener(event, handleActivity));
        resetIdleTimer();

        return () => {
            clearTimeout(idleTimer);
            events.forEach(event => window.removeEventListener(event, handleActivity));
        };
    }, [isPaused, currentDocument, saveCurrentSession]);

    // ========================================================================
    // Periodic Auto-Save - Save session every 30 seconds while reading
    // ========================================================================
    useEffect(() => {
        if (isPaused || !currentDocument) return;

        const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

        const autoSaveTimer = setInterval(() => {
            console.log("[Analytics] Auto-saving session...");
            saveCurrentSession();
        }, AUTO_SAVE_INTERVAL);

        return () => clearInterval(autoSaveTimer);
    }, [isPaused, currentDocument, saveCurrentSession]);

    // ========================================================================
    // Save on Window Unload
    // ========================================================================
    useEffect(() => {
        const handleUnload = () => {
            if (!isPaused && history.length > 0) {
                // Synchronous save attempt (may not complete)
                saveCurrentSession();
            }
        };

        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, [isPaused, history, saveCurrentSession]);

    // ========================================================================
    // Calculate Live Stats
    // ========================================================================
    const totalPagesRead = new Set(history.map(h => h.page)).size;
    const totalRecordedTime = history.reduce((acc, curr) => acc + curr.duration, 0);
    const avgTime = totalPagesRead > 0 ? totalRecordedTime / totalPagesRead : 0;

    const liveStats: LiveSessionStats = {
        startTime,
        totalDuration: getSessionDuration,
        getCurrentPageDuration,
        pagesRead: totalPagesRead,
        averageTimePerPage: avgTime,
        history,
        currentPage: lastPageParams.current.page,
    };

    return {
        // Live session
        isOpen,
        setIsOpen,
        isPaused,
        togglePause,
        stats: liveStats,

        // Analytics dashboard
        dashboard,
        refreshDashboard: loadDashboard,
    };
}

// ============================================================================
// Legacy Hook Export (for backwards compatibility)
// ============================================================================

export interface ReadingSession {
    startTime: number;
    totalDuration: number | (() => number);
    getCurrentPageDuration: () => number;
    pagesRead: number;
    averageTimePerPage: number;
    history: PageTime[];
    currentPage: number;
}

/**
 * @deprecated Use useReadingAnalytics instead
 */
export function useReadingStats() {
    const analytics = useReadingAnalytics();

    return {
        isOpen: analytics.isOpen,
        setIsOpen: analytics.setIsOpen,
        isPaused: analytics.isPaused,
        togglePause: analytics.togglePause,
        stats: analytics.stats as ReadingSession,
    };
}
