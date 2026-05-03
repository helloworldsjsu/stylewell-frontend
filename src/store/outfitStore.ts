import { create } from 'zustand';
import { fetchWardrobeOutfits, getMatchingWardrobeContext } from '../api/matching';
import { getOccasionRecommendation } from '../api/recommendations';
import { getWardrobeItems } from '../api/client';
import { saveOutfitHistoryRecord } from '../lib/supabase';
import { inferWardrobeSlot } from '../lib/wardrobeSlots';
import type { ClothingItem, ScoredOutfit, ShoppingSuggestion } from '../types/wardrobe';
import {
  clearMatchingCacheStorage,
  buildCacheKey,
  buildGlobalWardrobeHash,
  buildLockSignature,
  buildWardrobeHash,
  hydrateCacheFromStorage,
  readCachedMatching,
  resolveCacheCategory,
  type MatchingCacheCategory,
  writeCachedMatching,
} from './cacheUtils';

const DEFAULT_PREFETCH_OCCASIONS = ['casual', 'formal', 'party', 'interview'];
const outfitCache = new Map<string, { outfits: ScoredOutfit[]; total_combinations_checked: number; scenario: string }>();

hydrateCacheFromStorage(outfitCache);

interface OutfitStore {
  wardrobe: ClothingItem[];
  recommendedOutfits: ScoredOutfit[];
  shoppingSuggestions: ShoppingSuggestion[];
  isLoading: boolean;
  error: string | null;
  selectedOccasion: string | null;
  lockedTop: ClothingItem | null;
  lockedBottom: ClothingItem | null;
  lockedOther: ClothingItem | null;
  setOccasion: (occasion: string | null) => void;
  lockTop: (item: ClothingItem | null) => void;
  lockBottom: (item: ClothingItem | null) => void;
  lockOther: (item: ClothingItem | null) => void;
  fetchWardrobe: () => Promise<void>;
  findOutfits: () => Promise<void>;
  prefetchMatchingForCategory: (category: MatchingCacheCategory) => Promise<void>;
  getOccasionOutfit: () => Promise<void>;
  saveOutfit: (outfit: ScoredOutfit) => Promise<void>;
  clearRecommendations: () => void;
  clearMatchingCache: () => void;
}

// Request deduplication to prevent concurrent auth calls
let wardrobeFetchPromise: Promise<any> | null = null;
let outfitFetchPromise: Promise<void> | null = null;

export const useOutfitStore = create<OutfitStore>((set, get) => ({
  wardrobe: [],
  recommendedOutfits: [],
  shoppingSuggestions: [],
  isLoading: false,
  error: null,
  selectedOccasion: null,
  lockedTop: null,
  lockedBottom: null,
  lockedOther: null,

  setOccasion: (occasion) => set({ selectedOccasion: occasion }),
  lockTop: (item) => set((state) => ({
    lockedTop: item,
    lockedOther: item ? null : state.lockedOther,
  })),
  lockBottom: (item) => set((state) => ({
    lockedBottom: item,
    lockedOther: item ? null : state.lockedOther,
  })),
  lockOther: (item) => set((state) => ({
    lockedOther: item,
    lockedTop: item ? null : state.lockedTop,
    lockedBottom: item ? null : state.lockedBottom,
  })),

  fetchWardrobe: async () => {
    // Deduplicate concurrent requests
    if (wardrobeFetchPromise) {
      return wardrobeFetchPromise;
    }

    set({ isLoading: true, error: null });

    wardrobeFetchPromise = (async () => {
      try {
        const data = await getWardrobeItems();
      const items = (data.items ?? []).map((item: any) => {
        const description = typeof item.description === 'string' ? JSON.parse(item.description) : item.description ?? {};
        const category = description?.category ?? 'Unknown';

        return {
          id: item.id,
          image_url: item.image_url,
          category: description?.type ?? category,
          color: description?.color ?? 'Unknown',
          pattern: description?.pattern,
          sleeve_type: description?.sleeve_type,
          type: inferWardrobeSlot(description?.type, category),
          created_at: item.created_at,
          updated_at: item.updated_at ?? item.created_at,
        } as ClothingItem;
      });

        set({ wardrobe: items });
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch wardrobe';
        set({ error: message });
        throw error;
      } finally {
        set({ isLoading: false });
        wardrobeFetchPromise = null;
      }
    })();

    return wardrobeFetchPromise;
  },

  findOutfits: async () => {
    // Deduplicate concurrent requests
    if (outfitFetchPromise) {
      return outfitFetchPromise;
    }

    const state = get();
    set({ isLoading: true, error: null, shoppingSuggestions: [] });

    outfitFetchPromise = (async () => {
      try {
      const hasLockedSelection = Boolean(state.lockedTop?.id || state.lockedBottom?.id || state.lockedOther?.id);
      const cacheCategory = resolveCacheCategory({
        lockedTopId: state.lockedTop?.id,
        lockedBottomId: state.lockedBottom?.id,
        lockedOtherId: state.lockedOther?.id,
      });
      const lockSignature = buildLockSignature({
        lockedTopId: state.lockedTop?.id,
        lockedBottomId: state.lockedBottom?.id,
        lockedOtherId: state.lockedOther?.id,
      });

      const wardrobeContext = await getMatchingWardrobeContext();
      const globalWardrobeHash = buildGlobalWardrobeHash(wardrobeContext.wardrobe);
      const categorySet: MatchingCacheCategory[] = hasLockedSelection
        ? [cacheCategory]
        : ['topwear', 'bottomwear', 'others'];

      const cacheKeys = categorySet.map((category) => {
        const hash = hasLockedSelection
          ? globalWardrobeHash
          : buildWardrobeHash(wardrobeContext.wardrobe, category);
        const key = buildCacheKey({
          category,
          occasion: state.selectedOccasion ?? undefined,
          wardrobeHash: hash,
          lockSignature,
        });

        return {
          category,
          hash,
          key,
        };
      });

      const cachedResponses = cacheKeys.map((entry) => readCachedMatching(outfitCache, entry.key));
      const hasAllCacheEntries = cachedResponses.every((entry) => entry !== null);
      if (hasAllCacheEntries && cachedResponses[0]) {
        set({
          recommendedOutfits: cachedResponses[0].outfits,
          isLoading: false,
        });
        return;
      }

      const response = await fetchWardrobeOutfits({
        occasion: state.selectedOccasion ?? undefined,
        locked_top_id: state.lockedTop?.id,
        locked_bottom_id: state.lockedBottom?.id,
        locked_other_id: state.lockedOther?.id,
      }, {
        wardrobeContext,
        cacheCategory: hasLockedSelection ? cacheCategory : undefined,
        wardrobeHash: hasLockedSelection ? globalWardrobeHash : undefined,
        lockSignature: hasLockedSelection ? lockSignature : undefined,
      });

      cacheKeys.forEach((entry) => {
        writeCachedMatching(outfitCache, entry.key, response);
      });

        set({
          recommendedOutfits: response.outfits,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to find outfits';
        set({ error: message });
      } finally {
        set({ isLoading: false });
        outfitFetchPromise = null;
      }
    })();

    return outfitFetchPromise;
  },

  prefetchMatchingForCategory: async (category) => {
    try {
      const wardrobeContext = await getMatchingWardrobeContext();
      const hasCategoryItems = wardrobeContext.wardrobe.some((item) => item.type === category);
      if (!hasCategoryItems) {
        return;
      }

      const wardrobeHash = buildWardrobeHash(wardrobeContext.wardrobe, category);

      await Promise.all(
        DEFAULT_PREFETCH_OCCASIONS.map(async (occasion) => {
          const cacheKey = buildCacheKey({
            category,
            occasion,
            wardrobeHash,
            lockSignature: '',
          });

          if (readCachedMatching(outfitCache, cacheKey)) {
            return;
          }

          const response = await fetchWardrobeOutfits(
            {
              occasion,
            },
            {
              wardrobeContext,
              cacheCategory: category,
              wardrobeHash,
            },
          );

          writeCachedMatching(outfitCache, cacheKey, response);
        }),
      );
    } catch (error) {
      console.warn('Failed to prefetch matching cache', error);
    }
  },

  getOccasionOutfit: async () => {
    const state = get();
    if (!state.selectedOccasion) {
      set({ error: 'Please select an occasion first' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await getOccasionRecommendation({
        occasion: state.selectedOccasion,
        locked_top_id: state.lockedTop?.id,
        locked_bottom_id: state.lockedBottom?.id,
        locked_other_id: state.lockedOther?.id,
      });

      set({
        recommendedOutfits: [response.recommended_outfit, ...response.alternatives],
        shoppingSuggestions: response.shopping_suggestions,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get occasion recommendation';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  saveOutfit: async (outfit) => {
    try {
      await saveOutfitHistoryRecord({
        outfit,
        occasion: get().selectedOccasion,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save outfit';
      set({ error: message });
      throw error;
    }
  },

  clearRecommendations: () => {
    set({
      recommendedOutfits: [],
      shoppingSuggestions: [],
      error: null,
      selectedOccasion: null,
      lockedTop: null,
      lockedBottom: null,
      lockedOther: null,
    });
  },

  clearMatchingCache: () => {
    outfitCache.clear();
    clearMatchingCacheStorage();
  },
}));
