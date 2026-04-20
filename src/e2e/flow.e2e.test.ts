import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  hasSupabaseAuthEnv: vi.fn(() => true),
  saveGarmentWithClassification: vi.fn(async () => ({
    id: 'new-item-1',
    image_url: 'https://example.com/new-item.jpg',
    description: {
      type: 'Shirt',
      category: 'Topwear',
      color: 'White',
      pattern: 'Solid',
      fabric: 'Cotton',
      fit: 'Regular',
      occasion: 'Casual',
      season: 'All Season',
    },
    created_at: new Date().toISOString(),
  })),
  updateGarmentItem: vi.fn(async () => ({ success: true })),
  uploadGarmentImage: vi.fn(async () => ({
    id: 'new-item-1',
    image_url: 'https://example.com/new-item.jpg',
    description: {
      type: 'Shirt',
      category: 'Topwear',
      color: 'White',
      pattern: 'Solid',
      fabric: 'Cotton',
      fit: 'Regular',
      occasion: 'Casual',
      season: 'All Season',
    },
    created_at: new Date().toISOString(),
  })),
  getGarmentItems: vi.fn(async () => ({
    items: [
      {
        id: 'top-1',
        image_url: 'https://example.com/top.jpg',
        description: {
          type: 'Shirt',
          category: 'Topwear',
          color: 'Blue',
          pattern: 'Solid',
          fabric: 'Cotton',
          fit: 'Regular',
          occasion: 'Casual',
          season: 'All Season',
        },
        created_at: new Date().toISOString(),
      },
      {
        id: 'bottom-1',
        image_url: 'https://example.com/bottom.jpg',
        description: {
          type: 'Jeans',
          category: 'Bottomwear',
          color: 'Black',
          pattern: 'Solid',
          fabric: 'Denim',
          fit: 'Regular',
          occasion: 'Casual',
          season: 'All Season',
        },
        created_at: new Date().toISOString(),
      },
    ],
  })),
  deleteGarmentItem: vi.fn(async () => ({ success: true })),
  getOutfitHistory: vi.fn(async () => ({ history: [] })),
}));

vi.mock('../config/api', () => ({
  isLiveApiMode: () => false,
  buildApiUrl: (path: string) => path,
}));

describe('E2E flow: upload -> classify -> match -> suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes the full wardrobe suggestion pipeline', async () => {
    const { uploadClothingItem, classifyImage, getSuggestions } = await import('../api/client');
    const { fetchWardrobeOutfits } = await import('../api/matching');

    const image = new File(['dummy'], 'shirt.jpg', { type: 'image/jpeg' });

    const uploaded = await uploadClothingItem(image);
    expect(uploaded.id).toBeTruthy();

    const classified = await classifyImage(image);
    expect(classified.category.toLowerCase()).toContain('top');

    const matching = await fetchWardrobeOutfits({ occasion: 'casual' });
    expect(Array.isArray(matching.outfits)).toBe(true);
    expect(matching.outfits.length).toBeGreaterThan(0);

    const suggestions = await getSuggestions({
      occasion: 'casual',
      targetCategory: 'both',
      genderPreference: 'any',
      filters: {
        preferred_colors: ['navy'],
        preferred_patterns: ['solid'],
      },
      maxResults: 5,
    });

    expect(suggestions.suggestions).toEqual([]);
    expect(suggestions.error).toContain('disabled');
  });
});
