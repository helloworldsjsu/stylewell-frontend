export interface ClothingItem {
  id: string;
  user_id?: string;
  image_url: string;
  category: string;
  color: string;
  pattern?: string | null;
  sleeve_type?: string | null;
  type: 'topwear' | 'bottomwear' | string;
  confidence_score?: number | null;
  created_at?: string;
  occasion?: string | null;
}

export interface Weights {
  color: number;
  style: number;
  occasion: number;
}

export interface OutfitBreakdown {
  color: number;
  style: number;
  occasion: number;
}

export interface ScoredOutfit {
  top: ClothingItem;
  bottom: ClothingItem;
  score: number;
  breakdown: OutfitBreakdown;
  ai_reason: string;
  ai_tip: string;
}
