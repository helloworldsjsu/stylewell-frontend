import { fetchWardrobeOutfits } from './matching';
import type { OccasionResponse, OutfitHistoryResponse } from '../types/wardrobe';
import { isLiveApiMode } from '../config/api';
import { requestJson, toUserFacingApiMessage } from './http';
import { API_ROUTES, type GapAnalysisRequest, type GapAnalysisResponse, type RecommendOutfitsRequest, type RecommendOutfitsResponse } from './contracts';
import { getWardrobeItems } from './client';
import { normalizeOccasionResponse, normalizeWardrobeForRecommendation } from './recommendationNormalizers';
import { getOutfitHistory } from '../lib/supabase';

const RECOMMEND_OUTFITS_ROUTE_CANDIDATES = [
  API_ROUTES.recommendOutfits,
  `/api${API_ROUTES.recommendOutfits}`,
  '/recommend-outfits',
  '/api/recommend-outfits',
];

const GAP_ANALYSIS_ROUTE_CANDIDATES = [
  API_ROUTES.gapAnalysis,
  `/api${API_ROUTES.gapAnalysis}`,
  '/gap-analysis',
  '/api/gap-analysis',
];

function isNotFoundRouteError(error: unknown): boolean {
  return error instanceof Error && /requested resource was not found/i.test(error.message);
}

async function requestWithRouteFallback<T>(
  routes: string[],
  body: unknown,
  operationName: string,
): Promise<T> {
  let lastError: unknown;

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];
    try {
      return await requestJson<T>(
        route,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        {
          retries: 1,
          operationName,
        },
      );
    } catch (error) {
      lastError = error;
      const canTryNext = index < routes.length - 1;
      if (!canTryNext || !isNotFoundRouteError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to ${operationName}`);
}

export async function getOccasionRecommendation(params: {
  occasion: string;
  locked_top_id?: string;
  locked_bottom_id?: string;
  locked_other_id?: string;
}): Promise<OccasionResponse> {
  try {
    if (isLiveApiMode()) {
      const response = await getWardrobeItems();
      const wardrobe = normalizeWardrobeForRecommendation(response.items ?? []);
      const topSelected = params.locked_top_id
        ? wardrobe.find((item: any) => item.id === params.locked_top_id) ?? null
        : null;
      const bottomSelected = params.locked_bottom_id
        ? wardrobe.find((item: any) => item.id === params.locked_bottom_id) ?? null
        : null;
      const otherSelected = params.locked_other_id
        ? wardrobe.find((item: any) => item.id === params.locked_other_id) ?? null
        : null;

      const recommendPayload: RecommendOutfitsRequest = {
        occasion: params.occasion,
        top_selected: topSelected,
        bottom_selected: bottomSelected,
        other_selected: otherSelected,
        wardrobe_items: wardrobe,
      };

      const recommendResponse = await requestWithRouteFallback<RecommendOutfitsResponse>(
        RECOMMEND_OUTFITS_ROUTE_CANDIDATES,
        recommendPayload,
        'fetch occasion recommendation',
      );

      const gapPayload: GapAnalysisRequest = {
        wardrobe,
        occasion: params.occasion,
      };

      const gapResponse = await requestWithRouteFallback<GapAnalysisResponse>(
        GAP_ANALYSIS_ROUTE_CANDIDATES,
        gapPayload,
        'fetch shopping gap analysis',
      );

      return normalizeOccasionResponse(recommendResponse, gapResponse, {
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

    const data = await fetchWardrobeOutfits({
      occasion: params.occasion,
      locked_top_id: params.locked_top_id,
      locked_bottom_id: params.locked_bottom_id,
      locked_other_id: params.locked_other_id,
    });

    if (data.outfits.length === 0) {
      const normalized = String(params.occasion ?? '').trim().toLowerCase();
      if (normalized === 'wedding') {
        throw new Error('Add at least one item in Others to generate wedding recommendations.');
      }
      throw new Error('Add at least one top and one bottom to generate recommendations.');
    }

    const [recommended, ...alternatives] = data.outfits;

    return {
      recommended_outfit: {
        ...recommended,
        rank: 1,
      },
      alternatives: alternatives.map((outfit, index) => ({
        ...outfit,
        rank: index + 2,
      })),
      shopping_suggestions: [
        {
          category: 'Topwear',
          color: 'Neutral',
          pattern: 'Solid',
          reason: `Add one flexible topwear option for ${params.occasion} combinations.`,
          search_query: `${params.occasion} neutral topwear`,
        },
        {
          category: 'Bottomwear',
          color: 'Black',
          pattern: 'Solid',
          reason: 'A dark bottomwear piece increases matchability across your wardrobe.',
          search_query: 'black bottomwear versatile',
        },
      ],
    };
  } catch (error) {
    throw new Error(toUserFacingApiMessage(error, 'Failed to get occasion recommendation'));
  }
}

export async function getRecommendationHistory(): Promise<OutfitHistoryResponse> {
  return getOutfitHistory();
}
