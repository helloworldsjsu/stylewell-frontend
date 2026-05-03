import type { ClothingItem, MatchingResponse } from '../types/wardrobe';

export type MatchingCacheCategory = 'topwear' | 'bottomwear' | 'others';

const CACHE_STORAGE_KEY = 'outfitMatchingCache.v1';

interface CachedMatchingRecord {
  key: string;
  value: MatchingResponse;
  createdAt: number;
}

function stableOccasion(occasion?: string): string {
  return String(occasion ?? 'casual').trim().toLowerCase() || 'casual';
}

function normalizeTimestamp(item: ClothingItem): string {
  const rawUpdatedAt = (item as ClothingItem & { updated_at?: string | null }).updated_at;
  const updatedAt = typeof rawUpdatedAt === 'string' ? rawUpdatedAt : '';
  const createdAt = typeof item.created_at === 'string' ? item.created_at : '';
  return updatedAt || createdAt || '';
}

export function buildGlobalWardrobeHash(items: ClothingItem[]): string {
  const stableRows = items
    .map((item) => `${item.type}:${item.id}:${normalizeTimestamp(item)}`)
    .sort();

  const payload = `global|${stableRows.join('|')}`;

  // FNV-1a 32-bit hash for deterministic lightweight client hashing.
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = (hash >>> 0) * 0x01000193;
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildLockSignature(params: {
  lockedTopId?: string;
  lockedBottomId?: string;
  lockedOtherId?: string;
}): string {
  const top = String(params.lockedTopId ?? '').trim();
  const bottom = String(params.lockedBottomId ?? '').trim();
  const other = String(params.lockedOtherId ?? '').trim();
  if (!top && !bottom && !other) {
    return '';
  }
  return `top:${top || '-'}|bottom:${bottom || '-'}|other:${other || '-'}`;
}

export function buildWardrobeHash(items: ClothingItem[], category: MatchingCacheCategory): string {
  const stableRows = items
    .filter((item) => item.type === category)
    .map((item) => `${item.id}:${normalizeTimestamp(item)}`)
    .sort();

  const payload = `${category}|${stableRows.join('|')}`;

  // FNV-1a 32-bit hash for deterministic lightweight client hashing.
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = (hash >>> 0) * 0x01000193;
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildCacheKey(params: {
  category: MatchingCacheCategory;
  occasion?: string;
  wardrobeHash: string;
  lockSignature?: string;
}): string {
  return `${params.category}|${stableOccasion(params.occasion)}|${params.wardrobeHash}|${params.lockSignature ?? ''}`;
}

export function resolveCacheCategory(params: {
  lockedTopId?: string;
  lockedBottomId?: string;
  lockedOtherId?: string;
  fallback?: MatchingCacheCategory;
}): MatchingCacheCategory {
  if (params.lockedOtherId) return 'others';
  if (params.lockedBottomId && !params.lockedTopId) return 'bottomwear';
  if (params.lockedTopId) return 'topwear';
  return params.fallback ?? 'topwear';
}

export function hydrateCacheFromStorage(cache: Map<string, MatchingResponse>): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as CachedMatchingRecord[];
    if (!Array.isArray(parsed)) return;

    parsed.forEach((entry) => {
      if (!entry || typeof entry.key !== 'string' || !entry.value) {
        return;
      }
      cache.set(entry.key, entry.value);
    });
  } catch {
    // Ignore hydration failures and continue with in-memory cache only.
  }
}

export function persistCacheToStorage(cache: Map<string, MatchingResponse>): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    const records: CachedMatchingRecord[] = Array.from(cache.entries()).map(([key, value]) => ({
      key,
      value,
      createdAt: Date.now(),
    }));
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore persistence failures and continue with in-memory cache only.
  }
}

export function clearMatchingCacheStorage(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage clear failures and continue with in-memory cache only.
  }
}

export function readCachedMatching(cache: Map<string, MatchingResponse>, cacheKey: string): MatchingResponse | null {
  return cache.get(cacheKey) ?? null;
}

export function writeCachedMatching(cache: Map<string, MatchingResponse>, cacheKey: string, payload: MatchingResponse): void {
  cache.set(cacheKey, payload);
  persistCacheToStorage(cache);
}
