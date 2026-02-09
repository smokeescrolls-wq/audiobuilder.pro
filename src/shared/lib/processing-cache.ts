import { randomUUID } from "crypto";

export interface CacheEntry {
  sessionId: string;
  originalFilename: string;
  processedFilename: string;
  status: "processing" | "completed" | "failed";
  createdAt: Date;
  expiresAt: Date;

  // ✅ padroniza
  downloadUrl?: string;

  // (se quiser manter, pode — mas não precisa)
  s3Key?: string;
  s3Url?: string;

  outputPath?: string;
  localOnly?: boolean;
  error?: string;
  fileSize?: number;
  duration?: number;
}

const cache = new Map<string, CacheEntry>();

export function generateCacheId(): string {
  return randomUUID();
}

export function setCacheEntry(id: string, entry: CacheEntry): void {
  cache.set(id, entry);
  console.log(`[Cache] Set entry ${id}:`, entry.status);
}

export function getCacheEntry(id: string): CacheEntry | undefined {
  return cache.get(id);
}

export function getCacheEntriesBySession(sessionId: string): CacheEntry[] {
  const entries: CacheEntry[] = [];
  for (const [, entry] of cache.entries()) {
    if (entry.sessionId === sessionId) entries.push(entry);
  }
  return entries;
}

export function deleteCacheEntry(id: string): void {
  cache.delete(id);
  console.log(`[Cache] Deleted entry ${id}`);
}

export function cleanupExpiredEntries(): void {
  const now = new Date();
  const toDelete: string[] = [];

  for (const [id, entry] of cache.entries()) {
    if (entry.expiresAt < now) toDelete.push(id);
  }

  for (const id of toDelete) cache.delete(id);

  if (toDelete.length > 0) {
    console.log(`[Cache] Cleaned up ${toDelete.length} expired entries`);
  }
}

setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
