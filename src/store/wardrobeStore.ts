import { create } from 'zustand';

export interface ClothingItem {
  id: string;
  category: string;
  type: string;
  color: string;
  pattern?: string;
  fabric?: string;
  fit?: string;
  occasion?: string;
  season?: string;
  image_url: string;
  created_at: string;
}

export interface Outfit {
  top: ClothingItem;
  bottom: ClothingItem;
  other?: ClothingItem | null;
  compatibility_score: number;
  score_breakdown: {
    style_match: number;
    color_harmony: number;
    occasion_fit: number;
  };
}

interface WardrobeState {
  items: ClothingItem[];
  outfits: Outfit[];
  loading: boolean;
  setItems: (items: ClothingItem[]) => void;
  addItem: (item: ClothingItem) => void;
  removeItem: (id: string) => void;
  setOutfits: (outfits: Outfit[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useWardrobeStore = create<WardrobeState>((set) => ({
  items: [],
  outfits: [],
  loading: false,
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [item, ...state.items] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  setOutfits: (outfits) => set({ outfits }),
  setLoading: (loading) => set({ loading }),
}));
