import { describe, expect, it } from 'vitest';
import { inferWardrobeSlot } from './wardrobeSlots';

describe('inferWardrobeSlot', () => {
  it('maps one-piece outfits to others', () => {
    expect(inferWardrobeSlot('Kurta', 'Topwear')).toBe('others');
    expect(inferWardrobeSlot('Floral Dress', 'Topwear')).toBe('others');
    expect(inferWardrobeSlot('Jumpsuit', 'Ethnic')).toBe('others');
  });

  it('keeps classic tops and bottoms unchanged', () => {
    expect(inferWardrobeSlot('Shirt', 'Topwear')).toBe('topwear');
    expect(inferWardrobeSlot('Jeans', 'Bottomwear')).toBe('bottomwear');
  });
});
