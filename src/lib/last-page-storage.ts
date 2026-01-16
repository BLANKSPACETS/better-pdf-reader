/**
 * Last Page Storage - A lightweight localStorage-based system for persisting
 * the last read page for each document.
 *
 * This is a simple, non-intrusive solution that:
 * - Uses localStorage for fast read/write
 * - Debounces saves to avoid excessive writes on scroll
 * - Doesn't interfere with other app functionality
 * - Persists across sessions
 */

const STORAGE_KEY = "better-pdf-last-pages";

// In-memory cache for faster reads
let cache: Record<string, number> | null = null;

/**
 * Get the storage map from localStorage
 */
function getStorageMap(): Record<string, number> {
    if (cache !== null) {
        return cache;
    }

    if (typeof window === "undefined") {
        return {};
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed: Record<string, number> = stored ? JSON.parse(stored) : {};
        cache = parsed;
        return parsed;
    } catch {
        const empty: Record<string, number> = {};
        cache = empty;
        return empty;
    }
}

/**
 * Save the storage map to localStorage
 */
function saveStorageMap(map: Record<string, number>): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        cache = map;
    } catch (e) {
        console.warn("[LastPageStorage] Failed to save:", e);
    }
}

/**
 * Get the last read page for a document
 * @param documentId - The unique identifier of the document
 * @returns The last page number, or 1 if not found
 */
export function getLastPage(documentId: string): number {
    const map = getStorageMap();
    return map[documentId] ?? 1;
}

/**
 * Save the last read page for a document (immediate save)
 * @param documentId - The unique identifier of the document
 * @param page - The page number to save
 */
export function saveLastPage(documentId: string, page: number): void {
    const map = getStorageMap();
    map[documentId] = page;
    saveStorageMap(map);
}

/**
 * Remove the last page entry for a document (useful on document deletion)
 * @param documentId - The unique identifier of the document
 */
export function removeLastPage(documentId: string): void {
    const map = getStorageMap();
    delete map[documentId];
    saveStorageMap(map);
}

/**
 * Clear all last page entries
 */
export function clearAllLastPages(): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.removeItem(STORAGE_KEY);
        cache = {};
    } catch (e) {
        console.warn("[LastPageStorage] Failed to clear:", e);
    }
}

// ============================================================================
// Debounced Save Hook - For use in components
// ============================================================================

// Store debounce timers per document
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/**
 * Save the last page with debouncing to avoid excessive writes during scrolling.
 * @param documentId - The unique identifier of the document
 * @param page - The page number to save
 * @param debounceMs - Debounce delay in milliseconds (default: 500ms)
 */
export function saveLastPageDebounced(
    documentId: string,
    page: number,
    debounceMs: number = 500
): void {
    // Clear existing timer for this document
    if (debounceTimers[documentId]) {
        clearTimeout(debounceTimers[documentId]);
    }

    // Set new timer
    debounceTimers[documentId] = setTimeout(() => {
        saveLastPage(documentId, page);
        delete debounceTimers[documentId];
    }, debounceMs);
}

/**
 * Immediately flush any pending debounced saves for a document.
 * Useful when closing a document or the app.
 * @param documentId - The unique identifier of the document
 * @param page - The current page to save
 */
export function flushLastPage(documentId: string, page: number): void {
    // Clear any pending debounce
    if (debounceTimers[documentId]) {
        clearTimeout(debounceTimers[documentId]);
        delete debounceTimers[documentId];
    }

    // Save immediately
    saveLastPage(documentId, page);
}
