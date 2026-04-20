import { supabase } from '../lib/supabase';
import { inferWardrobeSlot } from '../lib/wardrobeSlots';
import type { ClothingItem } from '../types/wardrobe';

function parseDescription(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return {};
}

function fromClothingItemsRow(row: any): ClothingItem {
  return {
    id: row.id,
    user_id: row.user_id,
    image_url: row.image_url,
    category: row.category ?? 'Unknown',
    color: row.color ?? 'Unknown',
    pattern: row.pattern,
    sleeve_type: row.sleeve_type,
    type: inferWardrobeSlot(row.type, row.category),
    confidence_score: row.confidence_score,
    created_at: row.created_at,
  };
}

function fromGarmentItemsRow(row: any): ClothingItem {
  const description = parseDescription(row.description);
  return {
    id: row.id,
    user_id: row.user_id,
    image_url: row.image_url,
    category: description.category ?? description.type ?? 'Unknown',
    color: description.color ?? 'Unknown',
    pattern: description.pattern,
    sleeve_type: description.sleeve_type,
    type: inferWardrobeSlot(description.type, description.category),
    created_at: row.created_at,
  };
}

export async function fetchNormalizedWardrobe(userId?: string): Promise<ClothingItem[]> {
  const clothingResult = await supabase
    .from('clothing_items')
    .select('*')
    .eq('user_id', userId ?? '')
    .order('created_at', { ascending: false });

  if (!clothingResult.error && Array.isArray(clothingResult.data) && clothingResult.data.length > 0) {
    return clothingResult.data.map(fromClothingItemsRow);
  }

  const garmentResult = await supabase
    .from('garment_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (garmentResult.error) {
    const primaryError = clothingResult.error?.message ?? 'Unknown clothing_items error';
    const fallbackError = garmentResult.error.message;
    throw new Error(
      `Wardrobe query failed for both schemas. clothing_items: ${primaryError}; garment_items: ${fallbackError}`,
    );
  }

  const rows = (garmentResult.data ?? []).filter((row: any) => {
    if (!userId) return true;
    if (!row.user_id) return true;
    return row.user_id === userId;
  });

  return rows.map(fromGarmentItemsRow);
}
