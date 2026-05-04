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
  return rawItems.map((item: any, index: number) => {
    let description: any = {};

    // Parse description field
    if (typeof item.description === 'string') {
      try {
        description = JSON.parse(item.description);
      } catch (e) {
        console.warn('[toClothingItems] Failed to parse description:', item.description, e);
        description = {};
      }
    } else if (item.description && typeof item.description === 'object') {
      description = item.description;
    }

    // Debug logging (disabled for production - uncomment if needed)
    // if (index < 5) {
    //   console.log(`\n[toClothingItems #${index + 1}] ID: ${item.id}`);
    //   console.log('  📋 Raw description TYPE:', typeof item.description);
    //   console.log('  📋 Raw description VALUE:', item.description);
    //   console.log('  🎯 Parsed occasion:', description?.occasion || '❌ MISSING');
    //   console.log('  📦 Full parsed description:', description);
    // }

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

  // Debug logging (disabled for production)
  // console.log('[Wardrobe Context] Total items loaded:', wardrobe.length);
  // const itemsWithOccasion = wardrobe.filter(item => item.occasion);
  // console.log(`[Wardrobe Context] ${itemsWithOccasion.length} items have occasion data`);

  const userId = wardrobe.find((item) => typeof item.user_id === 'string' && item.user_id.trim().length > 0)?.user_id;
  return {
    wardrobe,
    userId,
  };
}

function normalizedColor(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeOccasion(value?: string): string {
  return String(value ?? 'casual').trim().toLowerCase();
}

function isWeddingOccasion(value?: string): boolean {
  return normalizeOccasion(value) === 'wedding';
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
  const combinedCat = `${top.category} ${bottom.category}`.toLowerCase();
  const formalBoost = /(blazer|shirt|trouser|pant|slack|blouse)/.test(combinedCat);
  const casualBoost = /(t-shirt|tee|jean|chino)/.test(combinedCat);
  const ethnicBoost = /(kurta|sherwani|churidar)/.test(combinedCat);

  let baseScore = 70;

  // Formal occasions
  if (requestedOccasion === 'formal' || requestedOccasion === 'interview' || requestedOccasion === 'wedding') {
    if (formalBoost) {
      baseScore = Math.floor(82 + Math.random() * 12); // 82-93
    } else if (casualBoost) {
      baseScore = Math.floor(40 + Math.random() * 15); // 40-54 (too casual)
    } else {
      baseScore = Math.floor(60 + Math.random() * 15); // 60-74
    }
  }
  // Party occasions
  else if (requestedOccasion === 'party' || requestedOccasion === 'evening') {
    if (ethnicBoost || formalBoost) {
      baseScore = Math.floor(80 + Math.random() * 12); // 80-91
    } else if (casualBoost) {
      baseScore = Math.floor(55 + Math.random() * 15); // 55-69
    } else {
      baseScore = Math.floor(72 + Math.random() * 10); // 72-81
    }
  }
  // Casual occasions
  else {
    if (casualBoost) {
      baseScore = Math.floor(78 + Math.random() * 14); // 78-91
    } else if (formalBoost) {
      baseScore = Math.floor(65 + Math.random() * 15); // 65-79 (overdressed)
    } else {
      baseScore = Math.floor(70 + Math.random() * 12); // 70-81
    }
  }

  // Apply heavy penalty if item's stored occasion doesn't match requested occasion
  const topCompatible = isOccasionCompatible(top.occasion, requestedOccasion);
  const bottomCompatible = isOccasionCompatible(bottom.occasion, requestedOccasion);

  // If either item is incompatible, severely reduce the score
  if (!topCompatible || !bottomCompatible) {
    return Math.max(5, Math.floor(baseScore * 0.25)); // 75% penalty for mismatched occasions
  }

  return baseScore;
}

function colorScore(top: ClothingItem, bottom: ClothingItem): number {
  const topColor = normalizedColor(top.color);
  const bottomColor = normalizedColor(bottom.color);

  // Exact match
  if (topColor === bottomColor) {
    return Math.floor(80 + Math.random() * 8); // 80-87
  }

  // Complementary pairs (high scores)
  const complementaryPairs = [
    ['white', 'black'], ['black', 'white'],
    ['navy', 'white'], ['white', 'navy'],
    ['beige', 'brown'], ['brown', 'beige'],
    ['grey', 'navy'], ['navy', 'grey'],
    ['blue', 'white'], ['white', 'blue'],
  ];

  const isComplementary = complementaryPairs.some(
    ([c1, c2]) => (topColor.includes(c1) && bottomColor.includes(c2))
  );
  if (isComplementary) {
    return Math.floor(82 + Math.random() * 10); // 82-91
  }

  // Neutral combinations (medium-high scores)
  const neutrals = ['white', 'black', 'grey', 'gray', 'beige', 'cream', 'navy'];
  const topIsNeutral = neutrals.some(n => topColor.includes(n));
  const bottomIsNeutral = neutrals.some(n => bottomColor.includes(n));

  if (topIsNeutral && bottomIsNeutral) {
    return Math.floor(75 + Math.random() * 10); // 75-84
  }

  if (topIsNeutral || bottomIsNeutral) {
    return Math.floor(70 + Math.random() * 12); // 70-81
  }

  // Clashing bright colors (low scores)
  const brightColors = ['red', 'orange', 'yellow', 'green', 'purple', 'pink'];
  const topIsBright = brightColors.some(b => topColor.includes(b));
  const bottomIsBright = brightColors.some(b => bottomColor.includes(b));

  if (topIsBright && bottomIsBright && topColor !== bottomColor) {
    return Math.floor(45 + Math.random() * 20); // 45-64 (potential clash)
  }

  // Default: average combinations
  return Math.floor(65 + Math.random() * 12); // 65-76
}

function styleScore(top: ClothingItem, bottom: ClothingItem): number {
  const topCat = top.category.toLowerCase();
  const bottomCat = bottom.category.toLowerCase();

  // Perfect formal pairings
  if ((/(shirt|blazer|blouse)/.test(topCat)) && (/(trouser|pant|slack)/.test(bottomCat))) {
    return Math.floor(85 + Math.random() * 10); // 85-94
  }

  // Perfect casual pairings
  if ((/(t-shirt|tee|polo)/.test(topCat)) && (/(jean|chino)/.test(bottomCat))) {
    return Math.floor(80 + Math.random() * 12); // 80-91
  }

  // Ethnic coordination
  if ((/(kurta|sherwani)/.test(topCat)) && (/(churidar|pyjama)/.test(bottomCat))) {
    return Math.floor(88 + Math.random() * 8); // 88-95
  }

  // Mixed formality (style clash)
  const topFormal = /(shirt|blazer|blouse)/.test(topCat);
  const bottomCasual = /(jean|short)/.test(bottomCat);
  const topCasual = /(t-shirt|tee|hoodie|sweatshirt)/.test(topCat);
  const bottomFormal = /(trouser|slack)/.test(bottomCat);

  if ((topFormal && bottomCasual) || (topCasual && bottomFormal)) {
    return Math.floor(55 + Math.random() * 20); // 55-74 (mixed formality)
  }

  // Default: neutral pairing
  return Math.floor(70 + Math.random() * 15); // 70-84
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
  const category = other.category.toLowerCase();
  const color = other.color.toLowerCase();

  // Color score based on versatility
  const neutralColors = ['black', 'white', 'grey', 'gray', 'beige', 'navy', 'cream'];
  const isNeutral = neutralColors.some(n => color.includes(n));
  const colorScore = isNeutral
    ? Math.floor(78 + Math.random() * 12) // 78-89 (versatile)
    : Math.floor(70 + Math.random() * 15); // 70-84 (bold)

  // Style score based on category
  let styleBase = 75;
  if (/(dress|gown)/.test(category)) {
    styleBase = Math.floor(85 + Math.random() * 10); // 85-94 (elegant)
  } else if (/(kurta|sherwani)/.test(category)) {
    styleBase = Math.floor(82 + Math.random() * 12); // 82-93 (ethnic elegance)
  } else if (/(jumpsuit|romper)/.test(category)) {
    styleBase = Math.floor(78 + Math.random() * 10); // 78-87 (modern)
  } else {
    styleBase = Math.floor(70 + Math.random() * 12); // 70-81 (default)
  }

  // Occasion score
  let occasionBase = 75;
  if (occasionLower === 'formal' || occasionLower === 'interview') {
    if (/(gown|dress)/.test(category) && isNeutral) {
      occasionBase = Math.floor(85 + Math.random() * 10); // 85-94
    } else if (/(kurta|sherwani)/.test(category)) {
      occasionBase = Math.floor(70 + Math.random() * 12); // 70-81 (depends on style)
    } else {
      occasionBase = Math.floor(75 + Math.random() * 10); // 75-84
    }
  } else if (occasionLower === 'party' || occasionLower === 'evening') {
    if (/(gown|dress|kurta|sherwani)/.test(category)) {
      occasionBase = Math.floor(88 + Math.random() * 8); // 88-95 (perfect for parties)
    } else {
      occasionBase = Math.floor(78 + Math.random() * 10); // 78-87
    }
  } else {
    // Casual
    if (/(jumpsuit|romper)/.test(category)) {
      occasionBase = Math.floor(82 + Math.random() * 10); // 82-91 (great for casual)
    } else if (/(gown|sherwani)/.test(category)) {
      occasionBase = Math.floor(55 + Math.random() * 15); // 55-69 (overdressed)
    } else {
      occasionBase = Math.floor(72 + Math.random() * 12); // 72-83
    }
  }

  // Check if the item's stored occasion is compatible with the requested occasion
  const isCompatible = isOccasionCompatible(other.occasion, occasionLower);
  if (!isCompatible) {
    occasionBase = Math.max(5, Math.floor(occasionBase * 0.25)); // 75% penalty for mismatched occasions
  }

  const breakdown = {
    color: colorScore,
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
    const isWedding = isWeddingOccasion(params.occasion);
    const lockedTopId = isWedding ? undefined : params.locked_top_id;
    const lockedBottomId = isWedding ? undefined : params.locked_bottom_id;
    const lockedOtherId = params.locked_other_id;
    const wardrobeContext = options?.wardrobeContext ?? await getMatchingWardrobeContext();
    const wardrobe = wardrobeContext.wardrobe;

    if (isLiveApiMode()) {
      // console.log('[fetchWardrobeOutfits] Using LIVE API mode');
      const topSelected = lockedTopId
        ? wardrobe.find((item) => item.id === lockedTopId) ?? null
        : null;
      const bottomSelected = lockedBottomId
        ? wardrobe.find((item) => item.id === lockedBottomId) ?? null
        : null;
      const otherSelected = lockedOtherId
        ? wardrobe.find((item) => item.id === lockedOtherId) ?? null
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

      // console.log('[fetchWardrobeOutfits] Sending to backend API:', {
      //   occasion: payload.occasion,
      //   wardrobe_items_count: wardrobe.length,
      //   has_occasion_data: wardrobe.filter(i => i.occasion).length,
      // });

      const liveResponse = await requestRecommendOutfitsWithFallback(payload);

      // console.log('[fetchWardrobeOutfits] Got backend response:', {
      //   outfits_count: liveResponse.outfits?.length || 0,
      //   first_outfit_score: liveResponse.outfits?.[0]?.score,
      // });

      // If backend returns no outfits, fall back to frontend scoring
      if (!liveResponse.outfits || liveResponse.outfits.length === 0) {
        console.warn('[fetchWardrobeOutfits] Backend returned 0 outfits, falling back to frontend scoring');
        // Continue to frontend scoring below
      } else {
        return normalizeMatchingResponse(liveResponse, {
        lockedTopId,
        lockedBottomId,
        lockedOtherId,
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
    }

    // console.log('[fetchWardrobeOutfits] Using FALLBACK (frontend) scoring');
    // console.log('[fetchWardrobeOutfits] Requested occasion:', params.occasion || 'casual');

    const tops = wardrobe.filter((item) => item.type === 'topwear');
    const bottoms = wardrobe.filter((item) => item.type === 'bottomwear');
    const others = wardrobe.filter((item) => item.type === 'others');

    // console.log('[fetchWardrobeOutfits] Wardrobe breakdown:', {
    //   tops: tops.length,
    //   bottoms: bottoms.length,
    //   others: others.length,
    // });

    const selectedTops = lockedTopId ? tops.filter((item) => item.id === lockedTopId) : tops;
    const selectedBottoms = lockedBottomId ? bottoms.filter((item) => item.id === lockedBottomId) : bottoms;
    const selectedOthers = lockedOtherId
      ? others.filter((item) => item.id === lockedOtherId)
      : others;

    if (isWedding) {
      const weddingOutfits = selectedOthers
        .map((other) => standaloneOtherOutfit(other, params.occasion))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECOMMENDATIONS);

      return normalizeMatchingResponse({
        outfits: weddingOutfits,
        total_combinations_checked: selectedOthers.length,
        scenario: params.occasion ? 'occasion' : 'default',
      }, {
        lockedTopId,
        lockedBottomId,
        lockedOtherId,
        occasion: params.occasion,
      });
    }

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
        lockedTopId,
        lockedBottomId,
        lockedOtherId,
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

          // Log top 5 combinations for debugging
          const outfit = {
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

          return outfit;
        }),
      )
      .sort((a, b) => b.score - a.score);

    // console.log('[fetchWardrobeOutfits] Top 5 scored outfits:');
    // pairOutfits.slice(0, 5).forEach((outfit, idx) => {
    //   console.log(`  ${idx + 1}. ${outfit.top.color} ${outfit.top.category} + ${outfit.bottom.color} ${outfit.bottom.category}`);
    //   console.log(`     Score: ${outfit.score} (color: ${outfit.breakdown.color}, style: ${outfit.breakdown.style}, occasion: ${outfit.breakdown.occasion})`);
    // });

    const standaloneOutfits = selectedOthers.map((other) => standaloneOtherOutfit(other, params.occasion));

    const outfits = [...pairOutfits, ...standaloneOutfits]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECOMMENDATIONS);

    // console.log('[fetchWardrobeOutfits] Final recommendations:', outfits.length);

    return normalizeMatchingResponse({
      outfits,
      total_combinations_checked: (selectedTops.length * selectedBottoms.length) + selectedOthers.length,
      scenario: params.locked_top_id && params.locked_bottom_id ? 'locked_top+locked_bottom' : 'default',
    }, {
      lockedTopId,
      lockedBottomId,
      lockedOtherId,
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
