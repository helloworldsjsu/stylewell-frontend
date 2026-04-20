import type { WardrobeSlot } from '../types/wardrobe';

const STANDALONE_OUTFIT_PATTERN =
  /(kurta|dress|jumpsuit|romper|gown|saree|lehenga|co-?ord|co\s*set|one[-\s]?piece)/i;

const TOPWEAR_PATTERN =
  /(topwear|top|shirt|t-shirt|tee|blouse|hoodie|blazer|jacket|sweater|polo|coat)/i;

const BOTTOMWEAR_PATTERN =
  /(bottomwear|bottom|pant|pants|jean|jeans|trouser|trousers|short|shorts|skirt|jogger|joggers|palazzo|leggings|chinos)/i;

export function inferWardrobeSlot(...values: Array<unknown>): WardrobeSlot {
  const text = values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0)
    .join(' ')
    .toLowerCase();

  if (STANDALONE_OUTFIT_PATTERN.test(text)) return 'others';
  if (TOPWEAR_PATTERN.test(text)) return 'topwear';
  if (BOTTOMWEAR_PATTERN.test(text)) return 'bottomwear';
  return 'others';
}

export function getItemSlot(item: { type?: unknown; category?: unknown }): WardrobeSlot {
  return inferWardrobeSlot(item.type, item.category);
}

export function formatWardrobeSlotLabel(slot: WardrobeSlot): string {
  if (slot === 'topwear') return 'Topwear';
  if (slot === 'bottomwear') return 'Bottomwear';
  return 'Others';
}
