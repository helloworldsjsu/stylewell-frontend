import { describe, expect, it } from 'vitest';
import { normalizeClassificationPayload, normalizeGetItemsResponse } from './normalizers';
import { MAX_RECOMMENDATIONS, normalizeMatchingResponse } from './recommendationNormalizers';

describe('classification normalizers', () => {
  it('normalizes incomplete classification payload with defaults', () => {
    const normalized = normalizeClassificationPayload({ category: 'top', color: ' blue ' });
    expect(normalized.category).toBe('Topwear');
    expect(normalized.color).toBe('blue');
    expect(normalized.pattern).toBe('Unknown');
    expect(normalized.occasion).toBe('Casual');
  });

  it('normalizes get-items response and repairs malformed rows', () => {
    const normalized = normalizeGetItemsResponse({
      items: [
        {
          id: '1',
          image_url: 'img',
          description: '{"category":"Bottomwear","color":"Black"}',
        },
        {
          image_url: 'img2',
          description: null,
        },
      ],
    });

    expect(normalized.items).toHaveLength(2);
    expect(normalized.items[0].description).toMatchObject({ category: 'Bottomwear', color: 'Black' });
    expect(normalized.items[1].id).toContain('unknown-item-');
  });
});

describe('recommendation normalizers', () => {
  it('sorts and clips recommendation list to top 4 deterministically', () => {
    const normalized = normalizeMatchingResponse({
      recommendations: [
        { score: 11, top: { id: 't1' }, bottom: { id: 'b1' } },
        { score: 90, top: { id: 't2' }, bottom: { id: 'b2' } },
        { score: 73, top: { id: 't3' }, bottom: { id: 'b3' } },
        { score: 81, top: { id: 't4' }, bottom: { id: 'b4' } },
        { score: 65, top: { id: 't5' }, bottom: { id: 'b5' } },
        { score: 59, top: { id: 't6' }, bottom: { id: 'b6' } },
        { score: 4, top: { id: 't7' }, bottom: { id: 'b7' } },
      ],
    });

    expect(normalized.outfits).toHaveLength(MAX_RECOMMENDATIONS);
    expect(normalized.outfits[0].score).toBe(90);
    expect(normalized.outfits[1].score).toBe(81);
    expect(normalized.outfits[2].score).toBe(73);
    expect(normalized.outfits[3].score).toBe(65);
  });

  it('builds selected-outfit fallback for locked-top+locked-bottom case', () => {
    const normalized = normalizeMatchingResponse(
      {
        case: 'D',
        selected_outfit_score: {
          score: 88,
          breakdown: { color: 30, style: 29, occasion: 29 },
          reason: 'Strong pairing',
          tip: 'Add formal shoes',
        },
      },
      {
        lockedTopId: 'top-1',
        lockedBottomId: 'bottom-1',
        lockedTopItem: { id: 'top-1', category: 'Topwear', color: 'White', image_url: 'a' },
        lockedBottomItem: { id: 'bottom-1', category: 'Bottomwear', color: 'Black', image_url: 'b' },
      },
    );

    expect(normalized.outfits).toHaveLength(1);
    expect(normalized.outfits[0].score).toBe(88);
    expect(normalized.scenario).toContain('locked_top+locked_bottom');
  });

  it('normalizes standalone others-only recommendations', () => {
    const normalized = normalizeMatchingResponse({
      case: 'E',
      recommendations: [
        {
          score: 84,
          breakdown: { color: 80, style: 86, occasion: 86 },
          reason: 'Standalone look',
          tip: 'Keep accessories minimal',
          other: { id: 'o1', category: 'Kurta', color: 'Blue', image_url: 'img-o1' },
        },
      ],
    });

    expect(normalized.outfits).toHaveLength(1);
    expect(normalized.outfits[0].top).toBeNull();
    expect(normalized.outfits[0].bottom).toBeNull();
    expect(normalized.outfits[0].other?.id).toBe('o1');
    expect(normalized.scenario).toBe('locked_other');
  });

  it('ignores accessory or shoes fields for paired outfits', () => {
    const normalized = normalizeMatchingResponse({
      recommendations: [
        {
          score: 79,
          top: { id: 't1', category: 'Shirt', color: 'White', image_url: 't' },
          bottom: { id: 'b1', category: 'Jeans', color: 'Blue', image_url: 'b' },
          accessory: { id: 'a1', category: 'Watch', color: 'Black', image_url: 'a' },
          shoes: { id: 's1', category: 'Sneakers', color: 'White', image_url: 's' },
        },
      ],
    });

    expect(normalized.outfits).toHaveLength(1);
    expect(normalized.outfits[0].other).toBeNull();
  });
});
