import type { MatchingResponse, OccasionResponse, ScrapedSuggestionsResponse as SuggestionsApiResponse, SuggestionFilters } from '../types/wardrobe';
import type { GarmentClassification } from '../types/wardrobe';

export const API_ROUTES = {
  classify: '/classify',
  upload: '/upload',
  items: '/items',
  recommendOutfits: '/ai/recommend-outfits',
  gapAnalysis: '/ai/gap-analysis',
  suggestions: '/suggestions',
  scraperRecommend: '/scraper/recommend',
} as const;

export type ClassifyResponse = GarmentClassification;

export interface WardrobeItemRecord {
  id: string;
  image_url: string;
  description: GarmentClassification | Record<string, unknown> | string;
  created_at: string;
}

export interface GetItemsResponse {
  items: WardrobeItemRecord[];
}

export type UploadResponse = WardrobeItemRecord;

export interface UpdateItemRequest {
  description: GarmentClassification | Record<string, unknown>;
}

export interface RecommendOutfitsRequest {
  occasion: string;
  top_k?: number;
  top_selected: any | null;
  bottom_selected: any | null;
  other_selected?: any | null;
  wardrobe_items: any[];
  user_id?: string;
  cache_category?: 'topwear' | 'bottomwear' | 'others';
  wardrobe_hash?: string;
  lock_signature?: string;
}

export type RecommendOutfitsResponse = MatchingResponse & {
  recommendations?: any[];
  selected_outfit_score?: any;
  case?: string;
};

export interface GapAnalysisRequest {
  wardrobe: any[];
  occasion: string;
}

export interface GapAnalysisResponse {
  suggestions: {
    category: string;
    color: string;
    pattern: string;
    reason: string;
  }[];
}

export type SuggestionsRequest = {
  occasion: string;
  target_category: 'topwear' | 'bottomwear' | 'both';
  gender_preference: 'women' | 'men' | 'unisex' | 'any';
  filters: SuggestionFilters;
  max_results: number;
  wardrobe: any[];
  store?: 'nike' | 'zalando';
};

export type SuggestionsResponse = SuggestionsApiResponse;

export interface ScraperProduct {
  item_link: string;
  name: string;
  price: string;
  image_url: string;
  brand?: string;
  currency_symbol?: string;
  promotional_price?: string;
  original_price?: string;
  discount_percent?: string;
  reason?: string;
  match_score?: number;
  matched_with_slot?: 'topwear' | 'bottomwear';
  matched_garments?: Array<{
    id?: string;
    type?: 'topwear' | 'bottomwear' | string;
    category?: string;
    color?: string;
    score?: number;
    reason?: string;
  }>;
}

export interface ScraperQueryPlan {
  color: string;
  category: string;
  gender: string | null;
  query: string;
  reason: string;
  wardrobe_grounding?: string;
  color_resonance_scores?: Array<{
    color: string;
    score: number;
    reference_count?: number;
    global_count?: number;
    preferred?: boolean;
  }>;
  source?: 'gemma' | 'fallback';
  target_category?: 'topwear' | 'bottomwear' | 'both';
  style_direction?: string;
  occasion_bucket?: string;
  reference_item_ids?: string[];
}

export interface ScraperRecommendRequest {
  user_prompt?: string;
  occasion: string;
  gender?: string;
  preferences?: string;
  max_products?: number;
  store?: 'nike' | 'zalando';
  target_category?: 'topwear' | 'bottomwear' | 'both';
  filters?: SuggestionFilters;
}

export interface ScraperRecommendResponse {
  runtime_id: string;
  created_at: string;
  store?: 'nike' | string;
  occasion: string;
  gender: string;
  preferences: string;
  wardrobe_snapshot: unknown;
  query_plan: ScraperQueryPlan;
  search_urls: string[];
  product_urls: string[];
  products: ScraperProduct[];
  count: number;
  saved_json_path: string;
  intermediate_steps?: Array<{
    step: string;
    attempt?: number;
    query?: string;
    url_count?: number;
    new_products?: number;
    total_products?: number;
    errors?: string[];
    message?: string;
    attempted_queries?: string[];
    attempted_url_count?: number;
  }>;
  plan_source?: 'gemma' | 'fallback';
  plan_error?: string | null;
  scrape_error?: string | null;
}

export type OccasionRecommendationResponse = OccasionResponse;
