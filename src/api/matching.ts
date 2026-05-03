import { getWardrobeItems } from './client';
import type { ClothingItem, MatchingResponse } from '../types/wardrobe';
import { isLiveApiMode } from '../config/api';
import { requestJson, toUserFacingApiMessage } from './http';
import { API_ROUTES, type RecommendOutfitsRequest, type RecommendOutfitsResponse } from './contracts';
import {
  MAX_RECOMMENDATIONS,
  normalizeMatchingResponse,
  normalizeWardrobeForRecommendation,
} from './recommendationNormalizers';
import { inferWardrobeSlot } from '../lib/wardrobeSlots';
import type { MatchingCacheCategory } from '../store/cacheUtils';

const RECOMMEND_OUTFITS_ROUTE_CANDIDATES = [
  API_ROUTES.recommendOutfits,
  `/api${API_ROUTES.recommendOutfits}`,
  '/recommend-outfits',
  '/api/recommend-outfits',
];

function isNotFoundRouteError(error: unknown): boolean {
  return error instanceof Error && /requested resource was not found/i.test(error.message);
}

async function requestRecommendOutfitsWithFallback(
  payload: RecommendOutfitsRequest,
): Promise<RecommendOutfitsResponse> {
  let lastError: unknown;

  for (let index = 0; index < RECOMMEND_OUTFITS_ROUTE_CANDIDATES.length; index += 1) {
    const route = RECOMMEND_OUTFITS_ROUTE_CANDIDATES[index];
    try {
      return await requestJson<RecommendOutfitsResponse>(
        route,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        {
          retries: 1,
          operationName: 'fetch outfit recommendations',
        },
      );
    } catch (error) {
      lastError = error;
      const canTryNext = index < RECOMMEND_OUTFITS_ROUTE_CANDIDATES.length - 1;
      if (!canTryNext || !isNotFoundRouteError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch outfit recommendations');
}

function toClothingItems(rawItems: any[]): ClothingItem[] {
  return rawItems.map((item: any) => {
    const description = typeof item.description === 'string' ? JSON.parse(item.description) : item.description ?? {};
    const category = String(description?.category ?? description?.type ?? 'Unknown');
    return {
      id: item.id,
      user_id: item.user_id,
      image_url: item.image_url,
      category,
      color: description?.color ?? 'Unknown',
      pattern: description?.pattern,
      sleeve_type: description?.sleeve_type,
      type: inferWardrobeSlot(description?.type, category),
      created_at: item.created_at,
      updated_at: item.updated_at ?? item.created_at,
      occasion: description?.occasion ?? null,
    };
  });
}

export interface MatchingWardrobeContext {
  wardrobe: ClothingItem[];
  userId?: string;
}

export async function getMatchingWardrobeContext(): Promise<MatchingWardrobeContext> {
  const response = await getWardrobeItems();
  const wardrobe = normalizeWardrobeForRecommendation(toClothingItems(response.items ?? []));

  // Debug logging to verify occasion data is extracted
  console.log('[Wardrobe Context] Loaded items with occasions:');
  wardrobe.forEach(item => {
    if (item.occasion) {
      console.log(`  - ${item.color} ${item.category} (${item.type}): occasion = "${item.occasion}"`);
    }
  });

  const userId = wardrobe.find((item) => typeof item.user_id === 'string' && item.user_id.trim().length > 0)?.user_id;
  return {
    wardrobe,
    userId,
  };
}

function normalizedColor(value: string): string {
  return value.trim().toLowerCase();
}

function isOccasionCompatible(itemOccasion: string | null | undefined, requestedOccasion: string): boolean {
  if (!itemOccasion || !requestedOccasion) return true;

  const item = itemOccasion.toLowerCase().trim();
  const requested = requestedOccasion.toLowerCase().trim();

  // Direct match
  if (item === requested || item.includes(requested) || requested.includes(item)) {
    return true;
  }

  // Compatible groups
  const formalGroup = ['formal', 'work', 'interview', 'wedding'];
  const casualGroup = ['casual', 'everyday'];
  const partyGroup = ['party', 'evening', 'night'];

  const itemInFormal = formalGroup.some(occ => item.includes(occ));
  const requestedInFormal = formalGroup.some(occ => requested.includes(occ));

  const itemInCasual = casualGroup.some(occ => item.includes(occ));
  const requestedInCasual = casualGroup.some(occ => requested.includes(occ));

  const itemInParty = partyGroup.some(occ => item.includes(occ));
  const requestedInParty = partyGroup.some(occ => requested.includes(occ));

  // Both in same group = compatible
  return (itemInFormal && requestedInFormal) ||
         (itemInCasual && requestedInCasual) ||
         (itemInParty && requestedInParty);
}

function occasionScore(occasion: string | undefined, top: ClothingItem, bottom: ClothingItem): number {
  const requestedOccasion = (occasion ?? 'casual').toLowerCase();
  const formalBoost = /(blazer|shirt|trouser|pant)/.test(`${top.category} ${bottom.category}`.toLowerCase());

  let baseScore = 74;
  if (requestedOccasion === 'formal' || requestedOccasion === 'interview' || requestedOccasion === 'wedding') {
    baseScore = formalBoost ? 85 : 62;
  } else if (requestedOccasion === 'party') {
    baseScore = 78;
  }

  // Apply heavy penalty if item's stored occasion doesn't match requested occasion
  const topCompatible = isOccasionCompatible(top.occasion, requestedOccasion);
  const bottomCompatible = isOccasionCompatible(bottom.occasion, requestedOccasion);

  // Debug logging
  if (!topCompatible || !bottomCompatible) {
    console.log(`[Occasion Mismatch] Requested: ${requestedOccasion}`);
    console.log(`  Top: ${top.color} ${top.category} (occasion: ${top.occasion}) - Compatible: ${topCompatible}`);
    console.log(`  Bottom: ${bottom.color} ${bottom.category} (occasion: ${bottom.occasion}) - Compatible: ${bottomCompatible}`);
    console.log(`  Base score: ${baseScore}, Penalized score: ${Math.max(5, baseScore * 0.25)}`);
  }

  // If either item is incompatible, severely reduce the score
  if (!topCompatible || !bottomCompatible) {
    return Math.max(5, baseScore * 0.25); // 75% penalty for mismatched occasions
  }

  return baseScore;
}

function colorScore(top: ClothingItem, bottom: ClothingItem): number {
  const sameColor = normalizedColor(top.color) === normalizedColor(bottom.color);
  return sameColor ? 82 : 74;
}

function styleScore(top: ClothingItem, bottom: ClothingItem): number {
  const isFormalCombo = /(shirt|blazer)/i.test(top.category) && /(trouser|pant)/i.test(bottom.category);
  return isFormalCombo ? 88 : 76;
}

function buildReason(top: ClothingItem, bottom: ClothingItem, occasion: string | undefined): string {
  const selectedOccasion = occasion ?? 'casual';
  return `${top.color} ${top.category} pairs cleanly with ${bottom.color} ${bottom.category} for ${selectedOccasion} wear.`;
}

function buildTip(occasion: string | undefined): string {
  if (!occasion) return 'Add a neutral sneaker or loafer to keep this versatile.';
  if (occasion.toLowerCase() === 'formal') return 'A structured watch or belt will sharpen this look.';
  return 'Use accessories that match one shared color from both garments.';
}

function standaloneOtherOutfit(other: ClothingItem, occasion: string | undefined) {
  const occasionLower = (occasion ?? 'casual').toLowerCase();
  const styleBase = /(dress|kurta|jumpsuit|romper|gown)/i.test(other.category) ? 88 : 80;
  const occasionBase = occasionLower === 'formal' || occasionLower === 'interview' ? 82 : 78;
  const breakdown = {
    color: 80,
    style: styleBase,
    occasion: occasionBase,
  };
  const score = Math.round((breakdown.color + breakdown.style + breakdown.occasion) / 3);

  return {
    score,
    breakdown,
    ai_reason: `${other.color} ${other.category} works as a complete standalone look for ${occasion ?? 'casual'} wear.`,
    ai_tip: 'Add footwear or accessories only after locking this single-piece base look.',
    top: null,
    bottom: null,
    other: {
      id: other.id,
      category: other.category,
      color: other.color,
      image_url: other.image_url,
    },
  };
}

export async function fetchWardrobeOutfits(params: {
  occasion?: string;
  locked_top_id?: string;
  locked_bottom_id?: string;
  locked_other_id?: string;
}, options?: {
  wardrobeContext?: MatchingWardrobeContext;
  cacheCategory?: MatchingCacheCategory;
  wardrobeHash?: string;
  lockSignature?: string;
}): Promise<MatchingResponse> {
  try {
    const wardrobeContext = options?.wardrobeContext ?? await getMatchingWardrobeContext();
    const wardrobe = wardrobeContext.wardrobe;

    if (isLiveApiMode()) {
      const topSelected = params.locked_top_id
        ? wardrobe.find((item) => item.id === params.locked_top_id) ?? null
        : null;
      const bottomSelected = params.locked_bottom_id
        ? wardrobe.find((item) => item.id === params.locked_bottom_id) ?? null
        : null;
      const otherSelected = params.locked_other_id
        ? wardrobe.find((item) => item.id === params.locked_other_id) ?? null
        : null;

      const payload: RecommendOutfitsRequest = {
        occasion: params.occasion ?? 'casual',
        top_k: MAX_RECOMMENDATIONS,
        top_selected: topSelected,
        bottom_selected: bottomSelected,
        other_selected: otherSelected,
        wardrobe_items: wardrobe,
        user_id: wardrobeContext.userId,
        cache_category: options?.cacheCategory,
        wardrobe_hash: options?.wardrobeHash,
        lock_signature: options?.lockSignature,
      };

      const liveResponse = await requestRecommendOutfitsWithFallback(payload);

      return normalizeMatchingResponse(liveResponse, {
        lockedTopId: params.locked_top_id,
        lockedBottomId: params.locked_bottom_id,
        lockedOtherId: params.locked_other_id,
        occasion: params.occasion,
        lockedTopItem: topSelected
          ? {
              id: topSelected.id,
              category: topSelected.category,
              color: topSelected.color,
              image_url: topSelected.image_url,
            }
          : null,
        lockedBottomItem: bottomSelected
          ? {
              id: bottomSelected.id,
              category: bottomSelected.category,
              color: bottomSelected.color,
              image_url: bottomSelected.image_url,
            }
          : null,
      });
    }

    const tops = wardrobe.filter((item) => item.type === 'topwear');
    const bottoms = wardrobe.filter((item) => item.type === 'bottomwear');
    const others = wardrobe.filter((item) => item.type === 'others');

    const selectedTops = params.locked_top_id ? tops.filter((item) => item.id === params.locked_top_id) : tops;
    const selectedBottoms = params.locked_bottom_id ? bottoms.filter((item) => item.id === params.locked_bottom_id) : bottoms;
    const selectedOthers = params.locked_other_id
      ? others.filter((item) => item.id === params.locked_other_id)
      : others;

    if (selectedOthers.length > 0 && params.locked_other_id) {
      const standalone = selectedOthers
        .map((other) => standaloneOtherOutfit(other, params.occasion))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECOMMENDATIONS);

      return normalizeMatchingResponse({
        outfits: standalone,
        total_combinations_checked: selectedOthers.length,
        scenario: params.occasion ? 'locked_other+occasion' : 'locked_other',
      }, {
        lockedTopId: params.locked_top_id,
        lockedBottomId: params.locked_bottom_id,
        lockedOtherId: params.locked_other_id,
        occasion: params.occasion,
      });
    }

    const pairOutfits = selectedTops
      .flatMap((top) =>
        selectedBottoms.map((bottom) => {
          const breakdown = {
            color: colorScore(top, bottom),
            style: styleScore(top, bottom),
            occasion: occasionScore(params.occasion, top, bottom),
          };
          const score = Math.round((breakdown.color + breakdown.style + breakdown.occasion) / 3);
          return {
            score,
            breakdown,
            ai_reason: buildReason(top, bottom, params.occasion),
            ai_tip: buildTip(params.occasion),
            top: {
              id: top.id,
              category: top.category,
              color: top.color,
              image_url: top.image_url,
            },
            bottom: {
              id: bottom.id,
              category: bottom.category,
              color: bottom.color,
              image_url: bottom.image_url,
            },
            other: null,
          };
        }),
      )
      .sort((a, b) => b.score - a.score);

    const standaloneOutfits = selectedOthers.map((other) => standaloneOtherOutfit(other, params.occasion));

    const outfits = [...pairOutfits, ...standaloneOutfits]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECOMMENDATIONS);

    return normalizeMatchingResponse({
      outfits,
      total_combinations_checked: (selectedTops.length * selectedBottoms.length) + selectedOthers.length,
      scenario: params.locked_top_id && params.locked_bottom_id ? 'locked_top+locked_bottom' : 'default',
    }, {
      lockedTopId: params.locked_top_id,
      lockedBottomId: params.locked_bottom_id,
      lockedOtherId: params.locked_other_id,
      occasion: params.occasion,
    });
  } catch (error) {
    throw new Error(toUserFacingApiMessage(error, 'Failed to find outfits'));
  }
}

export async function matchNewItem(_params: {
  image_base64: string;
  occasion?: string;
}): Promise<MatchingResponse> {
  return {
    outfits: [],
    total_combinations_checked: 0,
    scenario: 'new_item',
  };
}
