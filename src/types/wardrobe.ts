export type WardrobeSlot = 'topwear' | 'bottomwear' | 'others';

export type OccasionType = 'interview' | 'party' | 'casual' | 'formal' | 'wedding';

export interface GarmentClassification {
  type: string;
  category: string;
  color: string;
  pattern: string;
  fabric: string;
  fit: string;
  occasion: string;
  season: string;
  sleeve_type?: string;
}

export type MatchingScenario =
  | 'default'
  | 'occasion'
  | 'locked_top'
  | 'locked_bottom'
  | 'locked_top+locked_bottom'
  | 'locked_top+occasion'
  | 'locked_bottom+occasion'
  | 'locked_top+locked_bottom+occasion'
  | 'new_item'
  | 'new_item+occasion';

export interface ClothingItem {
  id: string;
  user_id?: string;
  image_url: string;
  category: string;
  color: string;
  pattern?: string | null;
  sleeve_type?: string | null;
  type: WardrobeSlot;
  confidence_score?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface OutfitBreakdown {
  color: number;
  style: number;
  occasion: number;
}

export interface ScoredOutfit {
  rank?: number;
  score: number;
  breakdown: OutfitBreakdown;
  ai_reason: string;
  ai_tip: string;
  top: Pick<ClothingItem, 'id' | 'category' | 'color' | 'image_url'> | null;
  bottom: Pick<ClothingItem, 'id' | 'category' | 'color' | 'image_url'> | null;
  other?: Pick<ClothingItem, 'id' | 'category' | 'color' | 'image_url'> | null;
}

export interface ShoppingSuggestion {
  category: string;
  color: string;
  pattern: string;
  reason: string;
  search_query: string;
}

export interface SuggestionFilters {
  preferred_colors?: string[];
  preferred_patterns?: string[];
  preferred_fabrics?: string[];
  preferred_fits?: string[];
  preferred_styles?: string[];
  preferred_seasons?: string[];
  include_keywords?: string[];
  exclude_keywords?: string[];
}

export interface ScrapedShoppingSuggestion {
  target_category: 'topwear' | 'bottomwear';
  title: string;
  url: string;
  image_url: string;
  proxy_image_url?: string;
  store: string;
  match_score: number;
  reason: string;
  product_category: string;
  color: string;
  pattern: string;
  search_query: string;
  scrape_status: 'live' | 'fallback';
  scrape_error?: string | null;
  product_gender?: 'women' | 'men' | 'unisex' | 'unknown';
}

export interface ScrapedSuggestionsResponse {
  occasion: string;
  target_category: 'topwear' | 'bottomwear' | 'both';
  gender_preference?: 'women' | 'men' | 'unisex' | 'any';
  search_filters?: SuggestionFilters;
  suggestions: ScrapedShoppingSuggestion[];
  error?: string;
}

export interface MatchingResponse {
  outfits: ScoredOutfit[];
  total_combinations_checked: number;
  scenario: MatchingScenario | string;
}

export interface OccasionResponse {
  recommended_outfit: ScoredOutfit;
  alternatives: ScoredOutfit[];
  shopping_suggestions: ShoppingSuggestion[];
}

export interface OutfitHistoryRecord {
  id: string;
  compatibility_score: number;
  color_score: number;
  style_score: number;
  occasion_score: number;
  occasion: string;
  ai_reason: string;
  ai_tip: string;
  created_at: string;
  top: Pick<ClothingItem, 'id' | 'category' | 'color' | 'image_url'> | null;
  bottom: Pick<ClothingItem, 'id' | 'category' | 'color' | 'image_url'> | null;
}

export interface OutfitHistoryResponse {
  history: OutfitHistoryRecord[];
}
