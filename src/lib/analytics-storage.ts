import { Context, Effect, Layer, Schema } from "effect";

// ============================================================================
// Data Models - Comprehensive Reading Analytics
// ============================================================================

/** Time spent on a specific page during a reading session */
export class PageReadingTime extends Schema.Class<PageReadingTime>("PageReadingTime")({
    page: Schema.Number,
    durationMs: Schema.Number,
    visitCount: Schema.Number, // How many times user visited this page
}) { }

/** A single reading session for a document */
export class ReadingSessionRecord extends Schema.Class<ReadingSessionRecord>("ReadingSessionRecord")({
    id: Schema.String,
    documentId: Schema.String,
    startedAt: Schema.DateFromSelf,
    endedAt: Schema.DateFromSelf.pipe(Schema.NullOr),
    totalDurationMs: Schema.Number,
    pagesRead: Schema.Number,
    pageHistory: Schema.Array(PageReadingTime),
    // Reading velocity metrics
    avgTimePerPageMs: Schema.Number,
    fastestPageMs: Schema.Number,
    slowestPageMs: Schema.Number,
}) { }

/** Aggregated stats for a specific document */
export class DocumentStats extends Schema.Class<DocumentStats>("DocumentStats")({
    documentId: Schema.String,
    documentName: Schema.String,
    totalReadingTimeMs: Schema.Number,
    totalSessionCount: Schema.Number,
    totalPagesRead: Schema.Number,
    uniquePagesRead: Schema.Number,
    avgSessionDurationMs: Schema.Number,
    avgTimePerPageMs: Schema.Number,
    lastReadAt: Schema.DateFromSelf,
    firstReadAt: Schema.DateFromSelf,
    // Page-level heatmap data
    pageHeatmap: Schema.Record({ key: Schema.String, value: Schema.Number }), // page number -> total time
}) { }

/** Daily reading summary */
export class DailyReadingSummary extends Schema.Class<DailyReadingSummary>("DailyReadingSummary")({
    date: Schema.String, // YYYY-MM-DD format
    totalReadingTimeMs: Schema.Number,
    totalPagesRead: Schema.Number,
    sessionCount: Schema.Number,
    documentsRead: Schema.Array(Schema.String), // document IDs
}) { }

/** Global reading analytics (across all documents) */
export class GlobalAnalytics extends Schema.Class<GlobalAnalytics>("GlobalAnalytics")({
    id: Schema.Literal("global"),
    totalLifetimeReadingMs: Schema.Number,
    totalLifetimePagesRead: Schema.Number,
    totalLifetimeSessions: Schema.Number,
    avgReadingTimePerDayMs: Schema.Number,
    avgPagesPerDay: Schema.Number,
    longestSessionMs: Schema.Number,
    longestStreak: Schema.Number, // consecutive days
    currentStreak: Schema.Number,
    lastActiveDate: Schema.String, // YYYY-MM-DD
    weeklyData: Schema.Array(Schema.Number), // Last 7 days reading time in minutes
}) { }

// ============================================================================
// Errors
// ============================================================================

export class AnalyticsStorageError extends Schema.TaggedError<AnalyticsStorageError>()(
    "AnalyticsStorageError",
    { message: Schema.String, cause: Schema.Unknown }
) { }

// ============================================================================
// Analytics Storage Service
// ============================================================================

const ANALYTICS_DB_NAME = "better-pdf-analytics";
const ANALYTICS_DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const DOCUMENT_STATS_STORE = "document_stats";
const DAILY_SUMMARIES_STORE = "daily_summaries";
const GLOBAL_STORE = "global";

let analyticsDbPromise: Promise<IDBDatabase> | null = null;

function getAnalyticsDatabase(): Promise<IDBDatabase> {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("IndexedDB is only available in the browser"));
    }

    if (analyticsDbPromise) {
        return analyticsDbPromise;
    }

    analyticsDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(ANALYTICS_DB_NAME, ANALYTICS_DB_VERSION);

        request.onerror = () => {
            analyticsDbPromise = null;
            reject(new Error("Failed to open analytics database"));
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Sessions store - individual reading sessions
            if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
                const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
                sessionsStore.createIndex("documentId", "documentId");
                sessionsStore.createIndex("startedAt", "startedAt");
            }

            // Document stats store - aggregated per-document stats
            if (!db.objectStoreNames.contains(DOCUMENT_STATS_STORE)) {
                db.createObjectStore(DOCUMENT_STATS_STORE, { keyPath: "documentId" });
            }

            // Daily summaries store
            if (!db.objectStoreNames.contains(DAILY_SUMMARIES_STORE)) {
                db.createObjectStore(DAILY_SUMMARIES_STORE, { keyPath: "date" });
            }

            // Global analytics store
            if (!db.objectStoreNames.contains(GLOBAL_STORE)) {
                db.createObjectStore(GLOBAL_STORE, { keyPath: "id" });
            }
        };
    });

    return analyticsDbPromise;
}

// Helper to get today's date string
function getTodayString(): string {
    return new Date().toISOString().split("T")[0] ?? "";
}

export class AnalyticsStorage extends Context.Tag("@app/AnalyticsStorage")<
    AnalyticsStorage,
    {
        // Session operations
        readonly saveSession: (session: typeof ReadingSessionRecord.Type) => Effect.Effect<void, AnalyticsStorageError>;
        readonly getSessionsForDocument: (documentId: string) => Effect.Effect<typeof ReadingSessionRecord.Type[], AnalyticsStorageError>;
        readonly getRecentSessions: (limit: number) => Effect.Effect<typeof ReadingSessionRecord.Type[], AnalyticsStorageError>;

        // Document stats operations
        readonly getDocumentStats: (documentId: string) => Effect.Effect<typeof DocumentStats.Type | null, AnalyticsStorageError>;
        readonly updateDocumentStats: (stats: typeof DocumentStats.Type) => Effect.Effect<void, AnalyticsStorageError>;
        readonly getAllDocumentStats: () => Effect.Effect<typeof DocumentStats.Type[], AnalyticsStorageError>;

        // Daily summary operations
        readonly getDailySummary: (date: string) => Effect.Effect<typeof DailyReadingSummary.Type | null, AnalyticsStorageError>;
        readonly updateDailySummary: (summary: typeof DailyReadingSummary.Type) => Effect.Effect<void, AnalyticsStorageError>;
        readonly getWeeklySummaries: () => Effect.Effect<typeof DailyReadingSummary.Type[], AnalyticsStorageError>;

        // Global analytics operations
        readonly getGlobalAnalytics: () => Effect.Effect<typeof GlobalAnalytics.Type, AnalyticsStorageError>;
        readonly updateGlobalAnalytics: (analytics: typeof GlobalAnalytics.Type) => Effect.Effect<void, AnalyticsStorageError>;
    }
>() {
    static readonly layer = Layer.succeed(
        AnalyticsStorage,
        AnalyticsStorage.of({
            // ================================================================
            // Session Operations
            // ================================================================
            saveSession: Effect.fn("AnalyticsStorage.saveSession")(function* (session: typeof ReadingSessionRecord.Type) {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                const plainSession = {
                    id: session.id,
                    documentId: session.documentId,
                    startedAt: session.startedAt,
                    endedAt: session.endedAt,
                    totalDurationMs: session.totalDurationMs,
                    pagesRead: session.pagesRead,
                    pageHistory: session.pageHistory.map(p => ({
                        page: p.page,
                        durationMs: p.durationMs,
                        visitCount: p.visitCount,
                    })),
                    avgTimePerPageMs: session.avgTimePerPageMs,
                    fastestPageMs: session.fastestPageMs,
                    slowestPageMs: session.slowestPageMs,
                };

                yield* Effect.tryPromise({
                    try: () => new Promise<void>((resolve, reject) => {
                        const transaction = db.transaction(SESSIONS_STORE, "readwrite");
                        const store = transaction.objectStore(SESSIONS_STORE);
                        const request = store.put(plainSession);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to save session", cause: error }),
                });
            }),

            getSessionsForDocument: Effect.fn("AnalyticsStorage.getSessionsForDocument")(function* (documentId: string) {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                return yield* Effect.tryPromise({
                    try: () => new Promise<typeof ReadingSessionRecord.Type[]>((resolve, reject) => {
                        const transaction = db.transaction(SESSIONS_STORE, "readonly");
                        const store = transaction.objectStore(SESSIONS_STORE);
                        const index = store.index("documentId");
                        const request = index.getAll(documentId);
                        request.onsuccess = () => resolve(request.result || []);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to get sessions", cause: error }),
                });
            }),

            getRecentSessions: Effect.fn("AnalyticsStorage.getRecentSessions")(function* (limit: number) {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                const allSessions = yield* Effect.tryPromise({
                    try: () => new Promise<typeof ReadingSessionRecord.Type[]>((resolve, reject) => {
                        const transaction = db.transaction(SESSIONS_STORE, "readonly");
                        const store = transaction.objectStore(SESSIONS_STORE);
                        const request = store.getAll();
                        request.onsuccess = () => resolve(request.result || []);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to get sessions", cause: error }),
                });

                // Sort by startedAt desc and take limit
                return allSessions
                    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                    .slice(0, limit);
            }),

            // ================================================================
            // Document Stats Operations
            // ================================================================
            getDocumentStats: Effect.fn("AnalyticsStorage.getDocumentStats")(function* (documentId: string) {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                return yield* Effect.tryPromise({
                    try: () => new Promise<typeof DocumentStats.Type | null>((resolve, reject) => {
                        const transaction = db.transaction(DOCUMENT_STATS_STORE, "readonly");
                        const store = transaction.objectStore(DOCUMENT_STATS_STORE);
                        const request = store.get(documentId);
                        request.onsuccess = () => resolve(request.result || null);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to get document stats", cause: error }),
                });
            }),

            updateDocumentStats: Effect.fn("AnalyticsStorage.updateDocumentStats")(function* (stats: typeof DocumentStats.Type) {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                const plainStats = {
                    documentId: stats.documentId,
                    documentName: stats.documentName,
                    totalReadingTimeMs: stats.totalReadingTimeMs,
                    totalSessionCount: stats.totalSessionCount,
                    totalPagesRead: stats.totalPagesRead,
                    uniquePagesRead: stats.uniquePagesRead,
                    avgSessionDurationMs: stats.avgSessionDurationMs,
                    avgTimePerPageMs: stats.avgTimePerPageMs,
                    lastReadAt: stats.lastReadAt,
                    firstReadAt: stats.firstReadAt,
                    pageHeatmap: stats.pageHeatmap,
                };

                yield* Effect.tryPromise({
                    try: () => new Promise<void>((resolve, reject) => {
                        const transaction = db.transaction(DOCUMENT_STATS_STORE, "readwrite");
                        const store = transaction.objectStore(DOCUMENT_STATS_STORE);
                        const request = store.put(plainStats);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to update document stats", cause: error }),
                });
            }),

            getAllDocumentStats: Effect.fn("AnalyticsStorage.getAllDocumentStats")(function* () {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                return yield* Effect.tryPromise({
                    try: () => new Promise<typeof DocumentStats.Type[]>((resolve, reject) => {
                        const transaction = db.transaction(DOCUMENT_STATS_STORE, "readonly");
                        const store = transaction.objectStore(DOCUMENT_STATS_STORE);
                        const request = store.getAll();
                        request.onsuccess = () => resolve(request.result || []);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to get all document stats", cause: error }),
                });
            }),

            // ================================================================
            // Daily Summary Operations
            // ================================================================
            getDailySummary: Effect.fn("AnalyticsStorage.getDailySummary")(function* (date: string) {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                return yield* Effect.tryPromise({
                    try: () => new Promise<typeof DailyReadingSummary.Type | null>((resolve, reject) => {
                        const transaction = db.transaction(DAILY_SUMMARIES_STORE, "readonly");
                        const store = transaction.objectStore(DAILY_SUMMARIES_STORE);
                        const request = store.get(date);
                        request.onsuccess = () => resolve(request.result || null);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to get daily summary", cause: error }),
                });
            }),

            updateDailySummary: Effect.fn("AnalyticsStorage.updateDailySummary")(function* (summary: typeof DailyReadingSummary.Type) {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                yield* Effect.tryPromise({
                    try: () => new Promise<void>((resolve, reject) => {
                        const transaction = db.transaction(DAILY_SUMMARIES_STORE, "readwrite");
                        const store = transaction.objectStore(DAILY_SUMMARIES_STORE);
                        const request = store.put(summary);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to update daily summary", cause: error }),
                });
            }),

            getWeeklySummaries: Effect.fn("AnalyticsStorage.getWeeklySummaries")(function* () {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                const allSummaries = yield* Effect.tryPromise({
                    try: () => new Promise<typeof DailyReadingSummary.Type[]>((resolve, reject) => {
                        const transaction = db.transaction(DAILY_SUMMARIES_STORE, "readonly");
                        const store = transaction.objectStore(DAILY_SUMMARIES_STORE);
                        const request = store.getAll();
                        request.onsuccess = () => resolve(request.result || []);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to get weekly summaries", cause: error }),
                });

                // Get last 7 days
                const today = new Date();
                const last7Days: string[] = [];
                for (let i = 0; i < 7; i++) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    last7Days.push(d.toISOString().split("T")[0] ?? "");
                }

                return allSummaries.filter(s => last7Days.includes(s.date));
            }),

            // ================================================================
            // Global Analytics Operations
            // ================================================================
            getGlobalAnalytics: Effect.fn("AnalyticsStorage.getGlobalAnalytics")(function* () {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                const existing = yield* Effect.tryPromise({
                    try: () => new Promise<typeof GlobalAnalytics.Type | undefined>((resolve, reject) => {
                        const transaction = db.transaction(GLOBAL_STORE, "readonly");
                        const store = transaction.objectStore(GLOBAL_STORE);
                        const request = store.get("global");
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to get global analytics", cause: error }),
                });

                if (existing) {
                    return existing;
                }

                // Return default if none exists
                const defaultAnalytics: typeof GlobalAnalytics.Type = {
                    id: "global",
                    totalLifetimeReadingMs: 0,
                    totalLifetimePagesRead: 0,
                    totalLifetimeSessions: 0,
                    avgReadingTimePerDayMs: 0,
                    avgPagesPerDay: 0,
                    longestSessionMs: 0,
                    longestStreak: 0,
                    currentStreak: 0,
                    lastActiveDate: getTodayString(),
                    weeklyData: [0, 0, 0, 0, 0, 0, 0],
                };

                return defaultAnalytics;
            }),

            updateGlobalAnalytics: Effect.fn("AnalyticsStorage.updateGlobalAnalytics")(function* (analytics: typeof GlobalAnalytics.Type) {
                const db = yield* Effect.tryPromise({
                    try: () => getAnalyticsDatabase(),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to open analytics database", cause: error }),
                });

                yield* Effect.tryPromise({
                    try: () => new Promise<void>((resolve, reject) => {
                        const transaction = db.transaction(GLOBAL_STORE, "readwrite");
                        const store = transaction.objectStore(GLOBAL_STORE);
                        const request = store.put(analytics);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new AnalyticsStorageError({ message: "Failed to update global analytics", cause: error }),
                });
            }),
        })
    );
}
