import { randomUUID } from "crypto";

export interface CacheEntry {
  sessionId: string;
  originalFilename: string;
  processedFilename: string;
  status: "processing" | "completed" | "failed";
  expiresAt: Date;
  s3Key?: string;
  s3Url?: string;
  outputPath?: string;
  localOnly?: boolean;
  error?: string;
  fileSize?: number;
  duration?: number;
}

// In-memory cache for processing status
const cache = new Map<string, CacheEntry>();

/**
 * Generate a unique cache ID
 */
export function generateCacheId(): string {
  return randomUUID();
}

/**
 * Set a cache entry
 */
export function setCacheEntry(id: string, entry: CacheEntry): void {
  cache.set(id, entry);
  console.log(`[Cache] Set entry ${id}:`, entry.status);
}

/**
 * Get a cache entry by ID
 */
export function getCacheEntry(id: string): CacheEntry | undefined {
  return cache.get(id);
}

/**
 * Get all cache entries for a session
 */
export function getCacheEntriesBySession(sessionId: string): CacheEntry[] {
  const entries: CacheEntry[] = [];
for (const entry of cache.values()) {
  if (entry.sessionId === sessionId) {
    entries.push(entry);
  }
}

  return entries;
}

/**
 * Delete a cache entry
 */
export function deleteCacheEntry(id: string): void {
  cache.delete(id);
  console.log(`[Cache] Deleted entry ${id}`);
}

/**
 * Clean up expired cache entries
 */
export function cleanupExpiredEntries(): void {
  const now = new Date();
  const toDelete: string[] = [];

  for (const [id, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      toDelete.push(id);
    }
  }

  for (const id of toDelete) {
    cache.delete(id);
  }

  if (toDelete.length > 0) {
    console.log(`[Cache] Cleaned up ${toDelete.length} expired entries`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
