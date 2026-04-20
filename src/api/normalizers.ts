import type { GetItemsResponse, WardrobeItemRecord } from './contracts';
import type { GarmentClassification } from '../types/wardrobe';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toLower(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCategory(value: string): string {
  const normalized = toLower(value);
  if (normalized.includes('top')) return 'Topwear';
  if (normalized.includes('bottom')) return 'Bottomwear';
  return value;
}

export function validateImageFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image is too large. Please upload an image under 10MB.');
  }
}

export function normalizeClassificationPayload(payload: unknown): GarmentClassification {
  const source = (payload ?? {}) as Record<string, unknown>;
  const type = toNonEmptyString(source.type, 'Unknown');
  const rawCategory = toNonEmptyString(source.category, type);

  return {
    type,
    category: normalizeCategory(rawCategory),
    color: toNonEmptyString(source.color, 'Unknown'),
    pattern: toNonEmptyString(source.pattern, 'Unknown'),
    fabric: toNonEmptyString(source.fabric, 'Unknown'),
    fit: toNonEmptyString(source.fit, 'Unknown'),
    occasion: toNonEmptyString(source.occasion, 'Casual'),
    season: toNonEmptyString(source.season, 'All Season'),
  };
}

function parseDescription(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function normalizeWardrobeItemRecord(value: unknown, index: number): WardrobeItemRecord {
  const raw = (value ?? {}) as Record<string, unknown>;
  const description = normalizeClassificationPayload(parseDescription(raw.description));

  return {
    id: toNonEmptyString(raw.id, `unknown-item-${index}`),
    image_url: toNonEmptyString(raw.image_url, ''),
    description,
    created_at: toNonEmptyString(raw.created_at, new Date().toISOString()),
  };
}

export function normalizeGetItemsResponse(payload: unknown): GetItemsResponse {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    items: items.map((item, index) => normalizeWardrobeItemRecord(item, index)),
  };
}

export function normalizeUploadedGarment(payload: unknown): WardrobeItemRecord {
  return normalizeWardrobeItemRecord(payload, 0);
}
