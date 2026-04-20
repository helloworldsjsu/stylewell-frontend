import {
  deleteGarmentItem,
  getGarmentItems,
  hasSupabaseAuthEnv,
  saveGarmentWithClassification,
  updateGarmentItem,
} from '../lib/supabase';
import type { ClothingItem, ScrapedShoppingSuggestion, ScrapedSuggestionsResponse, SuggestionFilters } from '../types/wardrobe';
import { isLiveApiMode } from '../config/api';
import { requestJson, toUserFacingApiMessage } from './http';
import { API_ROUTES, type ClassifyResponse, type ScraperProduct, type ScraperRecommendRequest, type ScraperRecommendResponse, type SuggestionsRequest, type SuggestionsResponse, type UploadResponse, type UpdateItemRequest } from './contracts';
import { normalizeClassificationPayload, normalizeGetItemsResponse, normalizeWardrobeItemRecord, validateImageFile } from './normalizers';
import { getOutfitHistory } from '../lib/supabase';
import { logScrapeEvent } from '../lib/scrapeMonitoring';
import { inferWardrobeSlot } from '../lib/wardrobeSlots';

// 12s was causing false fallback when backend returned valid live results in ~13-15s.
const SCRAPER_TIMEOUT_MS = Number(import.meta.env.VITE_SCRAPER_TIMEOUT_MS ?? 20000);
const SCRAPER_MIN_INTERVAL_MS = Number(import.meta.env.VITE_SCRAPER_MIN_INTERVAL_MS ?? 1200);
const SCRAPER_MIN_RESULTS = Number(import.meta.env.VITE_SCRAPER_MIN_RESULTS ?? 4);
const SUGGESTIONS_ROUTE_CANDIDATES = [
  API_ROUTES.suggestions,
  `/api${API_ROUTES.suggestions}`,
  '/suggestions',
  '/api/suggestions',
];

const SCRAPER_RECOMMEND_ROUTE_CANDIDATES = [
  API_ROUTES.scraperRecommend,
  `/api${API_ROUTES.scraperRecommend}`,
  '/scraper/recommend',
  '/api/scraper/recommend',
];
let lastScraperRequestAt = 0;
const FALLBACK_IMAGE_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22320%22 viewBox=%220 0 320 320%22%3E%3Crect width=%22320%22 height=%22320%22 fill=%22%23eef2f7%22/%3E%3Ctext x=%22160%22 y=%22164%22 text-anchor=%22middle%22 fill=%22%2364748b%22 font-size=%2216%22 font-family=%22Arial,sans-serif%22%3EImage unavailable%3C/text%3E%3C/svg%3E';

function normalizeRenderableImageUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return FALLBACK_IMAGE_PLACEHOLDER;
  if (/^https?:\/\//.test(raw) || /^data:image\//.test(raw)) return raw;
  return FALLBACK_IMAGE_PLACEHOLDER;
}


function normalizeScraperProduct(raw: any) {
  return {
    name: String(raw?.name ?? raw?.title ?? 'Suggested Product'),
    item_link: String(raw?.item_link ?? raw?.url ?? raw?.link ?? '#'),
    price: String(raw?.price ?? 'N/A'),
    image_url: normalizeRenderableImageUrl(raw?.image_url ?? raw?.imageUrl ?? raw?.image),
  };
}
function toClothingItems(rawItems: any[]): ClothingItem[] {
  return rawItems.map((item: any) => {
    const description = normalizeClassificationPayload(item.description);
    return {
      id: item.id,
      image_url: item.image_url,
      category: description?.category ?? description?.type ?? 'Unknown',
      color: description?.color ?? 'Unknown',
      pattern: description?.pattern,
      sleeve_type: description?.sleeve_type,
      type: inferWardrobeSlot(description?.type, description?.category),
      created_at: item.created_at,
    };
  });
}


export async function getKimiScraperRecommendations(params: {
  userPrompt?: string;
  occasion: string;
  gender?: string;
  store?: 'nike' | 'zalando';
  targetCategory?: 'topwear' | 'bottomwear' | 'both';
  filters?: SuggestionFilters;
  preferences?: string;
  maxProducts?: number;
}): Promise<{
  runtime_id: string;
  created_at: string;
  store?: 'nike' | string;
  occasion: string;
  gender: string;
  preferences: string;
  query_plan: {
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
    source?: 'kimi' | 'fallback';
    target_category?: 'topwear' | 'bottomwear' | 'both';
    style_direction?: string;
    occasion_bucket?: string;
    reference_item_ids?: string[];
  };
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
  search_urls: string[];
  product_urls: string[];
    products: ScraperProduct[];
  count: number;
  saved_json_path: string;
}> {
  const payload: ScraperRecommendRequest = {
    user_prompt: params.userPrompt,
    occasion: params.occasion,
    gender: params.gender,
    target_category: params.targetCategory ?? 'both',
    filters: params.filters,
    preferences: params.preferences,
    store: params.store,
  };

  if (typeof params.maxProducts === 'number' && Number.isFinite(params.maxProducts)) {
    payload.max_products = params.maxProducts;
  }

  try {
    if (isLiveApiMode()) {
      try {
        const health = await requestJson<{ nvidia_api_configured?: string | boolean }>(
          '/health',
          {
            method: 'GET',
          },
          {
            retries: 0,
            operationName: 'check Kimi backend readiness',
          },
        );

        const configuredRaw = health?.nvidia_api_configured;
        const configuredText = String(configuredRaw ?? '').trim().toLowerCase();
        const isConfigured =
          configuredRaw === true ||
          configuredText === 'true' ||
          configuredText === '1' ||
          configuredText === 'yes';

        if (!isConfigured) {
          throw new Error('Kimi backend is not configured. NVIDIA_API_KEY is missing or unavailable on the hosted backend.');
        }
      } catch (healthError) {
        if (healthError instanceof Error && /not configured|nvidia_api_key/i.test(healthError.message)) {
          throw healthError;
        }
      }

      const liveResponse = await requestScraperWithRouteFallback(payload);
      const planSource = (liveResponse.query_plan as any)?.source;
      if (planSource && planSource !== 'kimi') {
        const plannerReason = String(
          liveResponse.plan_error ??
            (liveResponse.query_plan as any)?.reason ??
            liveResponse.scrape_error ??
            'Kimi planner unavailable.',
        ).trim();
        throw new Error(
          `Kimi planner was unavailable for this request. ${plannerReason} Non-Kimi fallback products are hidden by policy.`,
        );
      }

      return {
        ...liveResponse,
        store: String((liveResponse as any).store ?? params.store ?? 'nike'),
        occasion: String(liveResponse.occasion ?? params.occasion),
        gender: String(liveResponse.gender ?? params.gender ?? ''),
        preferences: String(liveResponse.preferences ?? params.preferences ?? ''),
        query_plan: {
          color: String((liveResponse.query_plan as any)?.color ?? 'neutral'),
          category: String((liveResponse.query_plan as any)?.category ?? 'mixed'),
          gender: ((liveResponse.query_plan as any)?.gender ?? params.gender ?? null) as string | null,
          query: String((liveResponse.query_plan as any)?.query ?? `${params.occasion} wardrobe-aware shopping`),
          reason: String(
            (liveResponse.query_plan as any)?.reason ??
              'Live scraper response received with a partial query plan.',
          ),
          wardrobe_grounding: String((liveResponse.query_plan as any)?.wardrobe_grounding ?? ''),
          color_resonance_scores: Array.isArray((liveResponse.query_plan as any)?.color_resonance_scores)
            ? (liveResponse.query_plan as any).color_resonance_scores
            : [],
          source: (liveResponse.query_plan as any)?.source,
          target_category: (liveResponse.query_plan as any)?.target_category,
          style_direction: (liveResponse.query_plan as any)?.style_direction,
          occasion_bucket: (liveResponse.query_plan as any)?.occasion_bucket,
          reference_item_ids: Array.isArray((liveResponse.query_plan as any)?.reference_item_ids)
            ? (liveResponse.query_plan as any).reference_item_ids.map((value: any) => String(value))
            : [],
        },
        intermediate_steps: Array.isArray((liveResponse as any).intermediate_steps)
          ? (liveResponse as any).intermediate_steps
          : [],
        products: Array.isArray(liveResponse.products)
          ? liveResponse.products
              .map((item) => normalizeScraperProduct(item))
              .filter((item) => item.item_link !== '#')
          : [],
      };
    }
    throw new Error('Kimi product feed is available only in live API mode.');
  } catch (error) {
    throw new Error(toUserFacingApiMessage(error, 'Failed to fetch Kimi-powered scraper recommendations'));
  }
}
function normalizeTerm(value: string): string {
  return value.trim().toLowerCase();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNotFoundRouteError(error: unknown): boolean {
  return error instanceof Error && /requested resource was not found/i.test(error.message);
}

function isAbortRequestError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('abort')) {
      return true;
    }
  }

  const maybeCause = (error as { cause?: unknown } | null | undefined)?.cause;
  return maybeCause instanceof DOMException && maybeCause.name === 'AbortError';
}

async function requestScraperWithRouteFallback(
  body: ScraperRecommendRequest,
): Promise<ScraperRecommendResponse> {
  let lastError: unknown;

  for (let index = 0; index < SCRAPER_RECOMMEND_ROUTE_CANDIDATES.length; index += 1) {
    const route = SCRAPER_RECOMMEND_ROUTE_CANDIDATES[index];
    try {
      return await requestJson<ScraperRecommendResponse>(
        route,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        {
          retries: 1,
          operationName: 'fetch Kimi-powered scraper recommendations',
        },
      );
    } catch (error) {
      lastError = error;
      const canTryNext = index < SCRAPER_RECOMMEND_ROUTE_CANDIDATES.length - 1;
      if (!canTryNext || !isNotFoundRouteError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch Kimi-powered scraper recommendations');
}

async function requestSuggestionsWithRouteFallback(
  body: SuggestionsRequest,
  signal: AbortSignal,
): Promise<SuggestionsResponse | { results?: any[]; items?: any[] }> {
  let lastError: unknown;

  for (let index = 0; index < SUGGESTIONS_ROUTE_CANDIDATES.length; index += 1) {
    const route = SUGGESTIONS_ROUTE_CANDIDATES[index];
    try {
      return await requestJson<SuggestionsResponse | { results?: any[]; items?: any[] }>(
        route,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal,
        },
        {
          retries: 1,
          operationName: 'fetch live scraped suggestions',
        },
      );
    } catch (error) {
      lastError = error;
      if (isAbortRequestError(error)) {
        throw error;
      }
      const canTryNext = index < SUGGESTIONS_ROUTE_CANDIDATES.length - 1;
      if (!canTryNext || !isNotFoundRouteError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch live scraped suggestions');
}

async function throttleScraperRequests() {
  const now = Date.now();
  const waitMs = Math.max(0, lastScraperRequestAt + SCRAPER_MIN_INTERVAL_MS - now);
  if (waitMs > 0) {
    await wait(waitMs);
  }
  lastScraperRequestAt = Date.now();
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTargetCategory(value: unknown, fallback: 'topwear' | 'bottomwear'): 'topwear' | 'bottomwear' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized.includes('bottom')) return 'bottomwear';
  if (normalized.includes('top')) return 'topwear';
  return fallback;
}

function normalizeGenderPreference(value: unknown): 'women' | 'men' | 'unisex' | 'unknown' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'women' || normalized === 'female' || normalized === 'woman') return 'women';
  if (normalized === 'men' || normalized === 'male' || normalized === 'man') return 'men';
  if (normalized === 'unisex' || normalized === 'any') return 'unisex';
  return 'unknown';
}

function includesAny(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const haystack = text.toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

function toCandidateText(item: ScrapedShoppingSuggestion): string {
  return [
    item.title,
    item.product_category,
    item.color,
    item.pattern,
    item.reason,
    item.search_query,
  ]
    .map((value) => String(value ?? ''))
    .join(' ')
    .toLowerCase();
}

function computeFilterBoost(item: ScrapedShoppingSuggestion, filters: SuggestionFilters): { boost: number; rejected: boolean } {
  const text = toCandidateText(item);
  let boost = 0;

  const addBoost = (values: string[] | undefined, weight: number) => {
    if (!values || values.length === 0) return;
    const normalized = values.map((value) => normalizeTerm(value));
    if (includesAny(text, normalized)) {
      boost += weight;
    }
  };

  addBoost(filters.preferred_colors, 4);
  addBoost(filters.preferred_patterns, 4);
  addBoost(filters.preferred_fabrics, 3);
  addBoost(filters.preferred_fits, 3);
  addBoost(filters.preferred_styles, 3);
  addBoost(filters.preferred_seasons, 2);
  addBoost(filters.include_keywords, 4);

  if (includesAny(text, (filters.exclude_keywords ?? []).map((value) => normalizeTerm(value)))) {
    return { boost: -999, rejected: true };
  }

  return { boost, rejected: false };
}

function normalizeLiveSuggestion(
  raw: any,
  fallbackTarget: 'topwear' | 'bottomwear',
  fallbackGender: 'women' | 'men' | 'unisex' | 'any',
): ScrapedShoppingSuggestion {
  const title = String(raw?.title ?? raw?.name ?? raw?.product_title ?? raw?.productName ?? 'Suggested Item');
  const url = String(raw?.url ?? raw?.product_url ?? raw?.link ?? '#');
  const imageUrl = String(raw?.image_url ?? raw?.image ?? raw?.imageUrl ?? '');
  const targetCategory = normalizeTargetCategory(raw?.target_category ?? raw?.targetCategory ?? raw?.type, fallbackTarget);
  const productCategory = String(raw?.product_category ?? raw?.category ?? raw?.productCategory ?? (targetCategory === 'topwear' ? 'Topwear' : 'Bottomwear'));
  const color = String(raw?.color ?? raw?.attributes?.color ?? 'Unknown');
  const pattern = String(raw?.pattern ?? raw?.attributes?.pattern ?? 'Unknown');
  const searchQuery = String(raw?.search_query ?? raw?.query ?? raw?.searchQuery ?? normalizeTerm(`${title} ${productCategory}`));
  const productGender = normalizeGenderPreference(raw?.product_gender ?? raw?.gender ?? fallbackGender);

  return {
    target_category: targetCategory,
    title,
    url,
    image_url: imageUrl,
    proxy_image_url: raw?.proxy_image_url ?? raw?.proxyImageUrl,
    store: String(raw?.store ?? raw?.source ?? raw?.site ?? 'Unknown Store'),
    match_score: Math.max(0, Math.min(100, toNumber(raw?.match_score ?? raw?.score ?? raw?.compatibility, 0))),
    reason: String(raw?.reason ?? raw?.explanation ?? 'Suggested based on your wardrobe and preferences.'),
    product_category: productCategory,
    color,
    pattern,
    search_query: searchQuery,
    scrape_status: raw?.scrape_status === 'fallback' ? 'fallback' : 'live',
    scrape_error: raw?.scrape_error ?? raw?.error ?? null,
    product_gender: productGender,
  };
}

function rankAndFilterSuggestions(params: {
  suggestions: ScrapedShoppingSuggestion[];
  filters: SuggestionFilters;
  targetCategory: 'topwear' | 'bottomwear' | 'both';
  genderPreference: 'women' | 'men' | 'unisex' | 'any';
  maxResults: number;
}): ScrapedShoppingSuggestion[] {
  const targetFiltered = params.suggestions.filter((item) => {
    if (params.targetCategory === 'both') return true;
    return item.target_category === params.targetCategory;
  });

  const genderFiltered = targetFiltered.filter((item) => {
    if (params.genderPreference === 'any') return true;
    if (!item.product_gender || item.product_gender === 'unknown') return true;
    return item.product_gender === params.genderPreference || item.product_gender === 'unisex';
  });

  const scored = genderFiltered
    .map((item) => {
      const filterEval = computeFilterBoost(item, params.filters);
      return {
        item,
        rejected: filterEval.rejected,
        rankingScore: item.match_score + filterEval.boost + (item.scrape_status === 'live' ? 2 : 0),
      };
    })
    .filter((entry) => !entry.rejected)
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      return b.item.match_score - a.item.match_score;
    })
    .slice(0, params.maxResults)
    .map((entry) => ({
      ...entry.item,
      match_score: Math.max(0, Math.min(100, Math.round(entry.rankingScore))),
    }));

  return scored;
}

function providerSearchUrl(provider: 'google' | 'myntra' | 'ajio', query: string): string {
  const encoded = encodeURIComponent(query);
  if (provider === 'myntra') return `https://www.myntra.com/${encoded}`;
  if (provider === 'ajio') return `https://www.ajio.com/search/?text=${encoded}`;
  return `https://www.google.com/search?q=${encoded}`;
}

function createProviderFallbackSuggestions(params: {
  occasion: string;
  targetCategory: 'topwear' | 'bottomwear' | 'both';
  genderPreference: 'women' | 'men' | 'unisex' | 'any';
  filters: SuggestionFilters;
  wardrobe: ClothingItem[];
  maxResults: number;
  seedSuggestions: ScrapedShoppingSuggestion[];
}): ScrapedShoppingSuggestion[] {
  if (params.seedSuggestions.length >= params.maxResults) {
    return params.seedSuggestions.slice(0, params.maxResults);
  }

  const providers: Array<{ key: 'google' | 'myntra' | 'ajio'; label: string }> = [
    { key: 'google', label: 'Google Shopping' },
    { key: 'myntra', label: 'Myntra' },
    { key: 'ajio', label: 'AJIO' },
  ];

  const existingUrls = new Set(params.seedSuggestions.map((item) => item.url));
  const extras: ScrapedShoppingSuggestion[] = [];

  for (let i = 0; i < providers.length && params.seedSuggestions.length + extras.length < params.maxResults; i += 1) {
    const fallback = buildFallbackSuggestions({
      occasion: params.occasion,
      targetCategory: params.targetCategory,
      genderPreference: params.genderPreference,
      filters: params.filters,
      wardrobe: params.wardrobe,
      reason: 'Low scraped result count. Added fallback providers.',
    }).suggestions;

    for (const item of fallback) {
      if (params.seedSuggestions.length + extras.length >= params.maxResults) break;

      const query = item.search_query || `${params.occasion} ${item.product_category}`;
      const url = providerSearchUrl(providers[i].key, query);
      if (existingUrls.has(url)) continue;

      existingUrls.add(url);
      extras.push({
        ...item,
        url,
        store: providers[i].label,
        scrape_status: 'fallback',
        scrape_error: 'Provider fallback used for low result scenario.',
      });
    }
  }

  if (extras.length > 0) {
    logScrapeEvent({
      type: 'scrape_fallback_provider_used',
      level: 'warn',
      message: 'Fallback providers appended due to low live scrape results.',
      context: {
        added: extras.length,
        targetCategory: params.targetCategory,
        genderPreference: params.genderPreference,
      },
    });
  }

  return [...params.seedSuggestions, ...extras].slice(0, params.maxResults);
}

function buildFallbackSuggestions(params: {
  occasion: string;
  targetCategory?: 'topwear' | 'bottomwear' | 'both';
  genderPreference?: 'women' | 'men' | 'unisex' | 'any';
  filters?: SuggestionFilters;
  wardrobe: ClothingItem[];
  reason?: string;
}): ScrapedSuggestionsResponse {
  const targetCategory = params.targetCategory ?? 'both';
  const gender = params.genderPreference ?? 'any';
  const filters: SuggestionFilters = params.filters ?? {};

  const preferredColor = filters.preferred_colors?.[0] ?? 'navy';
  const preferredPattern = filters.preferred_patterns?.[0] ?? 'solid';
  const includeKeyword = filters.include_keywords?.[0] ?? params.occasion;

  const suggestionTemplates = [
    {
      title: `${preferredColor} ${targetCategory === 'bottomwear' ? 'Tailored Pants' : 'Oxford Shirt'}`,
      category: targetCategory === 'bottomwear' ? 'Bottomwear' : 'Topwear',
      image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=80',
    },
    {
      title: `${preferredColor} ${targetCategory === 'topwear' ? 'Structured Blazer' : 'Straight Fit Jeans'}`,
      category: targetCategory === 'topwear' ? 'Topwear' : 'Bottomwear',
      image: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=80',
    },
    {
      title: `${includeKeyword} ${targetCategory === 'bottomwear' ? 'Pleated Trousers' : 'Minimal Knit Polo'}`,
      category: targetCategory === 'bottomwear' ? 'Bottomwear' : 'Topwear',
      image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80',
    },
  ];

  const suggestions: ScrapedShoppingSuggestion[] = suggestionTemplates.map((template, index) => {
    const target =
      targetCategory === 'both'
        ? index % 2 === 0
          ? 'topwear'
          : 'bottomwear'
        : targetCategory;

    const searchQuery = [params.occasion, preferredColor, preferredPattern, template.category]
      .map((value) => normalizeTerm(String(value)))
      .join(' ')
      .trim();

    return {
      target_category: target,
      title: template.title,
      url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
      image_url: template.image,
      store: 'Fallback Catalog',
      match_score: Math.max(70, 92 - index * 7),
      reason: `Fallback recommendation for ${params.occasion} using your wardrobe profile.`,
      product_category: template.category,
      color: preferredColor,
      pattern: preferredPattern,
      search_query: searchQuery,
      scrape_status: 'fallback',
      scrape_error: params.reason ?? null,
      product_gender: gender === 'any' ? 'unknown' : gender,
    };
  });

  return {
    occasion: params.occasion,
    target_category: targetCategory,
    gender_preference: gender,
    search_filters: filters,
    suggestions: rankAndFilterSuggestions({
      suggestions,
      filters,
      targetCategory,
      genderPreference: gender,
      maxResults: 8,
    }),
    error: params.reason,
  };
}

export async function uploadClothingItem(file: File, classificationOverride?: Record<string, unknown>) {
  validateImageFile(file);

  try {
    if (hasSupabaseAuthEnv()) {
      const classification = classificationOverride ?? await classifyImage(file);
      return await saveGarmentWithClassification(file, classification);
    }

    if (isLiveApiMode()) {
      const formData = new FormData();
      formData.append('image', file);

      const uploaded = await requestJson<UploadResponse>(
        API_ROUTES.upload,
        {
          method: 'POST',
          body: formData,
        },
        {
          retries: 1,
          operationName: 'upload garment item',
        },
      );

      if (classificationOverride && uploaded?.id) {
        const updated = await requestJson<UploadResponse>(
          `${API_ROUTES.items}/${uploaded.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ description: classificationOverride } satisfies UpdateItemRequest),
          },
          {
            retries: 1,
            operationName: 'update garment metadata',
          },
        );

        return normalizeWardrobeItemRecord(
          {
            ...updated,
            image_url: normalizeRenderableImageUrl(updated.image_url),
          },
          0,
        );
      }

      return normalizeWardrobeItemRecord(
        {
          ...uploaded,
          image_url: normalizeRenderableImageUrl(uploaded.image_url),
        },
        0,
      );
    }

    const classification = await classifyImage(file);
    return normalizeWardrobeItemRecord(
      {
        id: crypto.randomUUID(),
        image_url: normalizeRenderableImageUrl(URL.createObjectURL(file)),
        description: classification,
        created_at: new Date().toISOString(),
      },
      0,
    );
  } catch (error) {
    throw new Error(toUserFacingApiMessage(error, 'Failed to upload item'));
  }
}

export async function getWardrobeItems() {
  try {
    if (hasSupabaseAuthEnv()) {
      const payload = await getGarmentItems();
      return normalizeGetItemsResponse(payload);
    }

    if (isLiveApiMode()) {
      const payload = await requestJson<{ items?: unknown[] }>(
        API_ROUTES.items,
        {
          method: 'GET',
        },
        {
          retries: 1,
          operationName: 'fetch wardrobe items',
        },
      );

      return normalizeGetItemsResponse({
        items: (payload.items ?? []).map((item) => ({
          ...(item as Record<string, unknown>),
          image_url: normalizeRenderableImageUrl((item as Record<string, unknown>).image_url),
        })),
      });
    }

    return normalizeGetItemsResponse({ items: [] });
  } catch (error) {
    throw new Error(toUserFacingApiMessage(error, 'Failed to fetch items'));
  }
}

export async function deleteClothingItem(itemId: string) {
  try {
    if (hasSupabaseAuthEnv()) {
      return await deleteGarmentItem(itemId);
    }

    if (isLiveApiMode()) {
      return await requestJson<{ success?: boolean }>(
        `${API_ROUTES.items}/${itemId}`,
        {
          method: 'DELETE',
        },
        {
          retries: 1,
          operationName: 'delete wardrobe item',
        },
      );
    }

    return { success: true };
  } catch (error) {
    throw new Error(toUserFacingApiMessage(error, 'Failed to delete item'));
  }
}

export async function updateClothingItem(itemId: string, description: Record<string, unknown>) {
  try {
    if (hasSupabaseAuthEnv()) {
      await updateGarmentItem(itemId, description);
      return {
        ...normalizeWardrobeItemRecord(
        {
          id: itemId,
          image_url: '',
          description,
          created_at: new Date().toISOString(),
        },
        0,
        ),
        created_at: '',
      };
    }

    if (isLiveApiMode()) {
      const payload = await requestJson<UploadResponse>(
        `${API_ROUTES.items}/${itemId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ description } satisfies UpdateItemRequest),
        },
        {
          retries: 1,
          operationName: 'update wardrobe item',
        },
      );

      return normalizeWardrobeItemRecord(
        {
          ...payload,
          image_url: normalizeRenderableImageUrl(payload.image_url),
        },
        0,
      );
    }

    return normalizeWardrobeItemRecord(
      {
        id: itemId,
        image_url: FALLBACK_IMAGE_PLACEHOLDER,
        description,
        created_at: new Date().toISOString(),
      },
      0,
    );
  } catch (error) {
    throw new Error(toUserFacingApiMessage(error, 'Failed to update item'));
  }
}

export async function classifyImage(file: File) {
  validateImageFile(file);

  try {
    if (isLiveApiMode()) {
      const formData = new FormData();
      formData.append('image', file);
      const payload = await requestJson<ClassifyResponse>(
        API_ROUTES.classify,
        {
          method: 'POST',
          body: formData,
        },
        {
          retries: 1,
          operationName: 'classify garment image',
        },
      );
      return normalizeClassificationPayload(payload);
    }

    const name = file.name.toLowerCase();
    const fallbackSlot = inferWardrobeSlot(name);
    return normalizeClassificationPayload({
      type: fallbackSlot === 'bottomwear' ? 'Trousers' : fallbackSlot === 'topwear' ? 'Shirt' : 'Accessory',
      category: fallbackSlot === 'bottomwear' ? 'Bottomwear' : fallbackSlot === 'topwear' ? 'Topwear' : 'Others',
      color: 'Navy',
      pattern: 'Solid',
      fabric: 'Cotton',
      fit: 'Regular',
      occasion: 'Casual',
      season: 'All Season',
    });
  } catch (error) {
    throw new Error(toUserFacingApiMessage(error, 'Failed to classify image'));
  }
}

export async function matchWardrobe(occasion?: string) {
  // This would require additional Flask endpoint for matching logic
  // For now, returning mock data - implement actual matching logic as needed
  const items = await getWardrobeItems();
  return { items: items.items, occasion };
}

export async function matchNewItem(file: File, occasion?: string) {
  // First classify the new item
  const classification = await classifyImage(file);
  
  // Then match with existing wardrobe
  const wardrobe = await getWardrobeItems();
  
  return {
    newItem: classification,
    matches: wardrobe.items,
    occasion,
  };
}

export async function getOccasionRecommendation(occasion: string) {
  // This would require additional Flask endpoint for recommendations
  // For now, returning the wardrobe items filtered by occasion attribute
  const items = await getWardrobeItems();
  
  return {
    occasion,
    recommendations: items.items.filter((item: any) => 
      item.description?.occasion?.toLowerCase() === occasion.toLowerCase()
    ),
  };
}

export async function getRecommendationHistory() {
  return getOutfitHistory();
}

export async function getSuggestions(params: {
  occasion: string;
  targetCategory?: 'topwear' | 'bottomwear' | 'both';
  genderPreference?: 'women' | 'men' | 'unisex' | 'any';
  filters?: SuggestionFilters;
  maxResults?: number;
}): Promise<ScrapedSuggestionsResponse> {
  try {
    const itemsResponse = await getWardrobeItems();
    const wardrobe = toClothingItems(itemsResponse.items ?? []);
    const targetCategory = params.targetCategory ?? 'both';
    const genderPreference = params.genderPreference ?? 'any';
    const filters = params.filters ?? {};
    const maxResults = params.maxResults ?? 8;

    if (isLiveApiMode()) {
      await throttleScraperRequests();

      const payload: SuggestionsRequest = {
        occasion: params.occasion,
        target_category: targetCategory,
        gender_preference: genderPreference,
        filters,
        max_results: maxResults,
        wardrobe: itemsResponse.items ?? [],
      };

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS);

      try {
        const liveSuggestions = await requestSuggestionsWithRouteFallback(payload, controller.signal);

        const rawSuggestions = Array.isArray((liveSuggestions as any)?.suggestions)
          ? (liveSuggestions as any).suggestions
          : Array.isArray((liveSuggestions as any)?.results)
            ? (liveSuggestions as any).results
            : Array.isArray((liveSuggestions as any)?.items)
              ? (liveSuggestions as any).items
              : [];

        if (!liveSuggestions || rawSuggestions.length === 0) {
          logScrapeEvent({
            type: 'scrape_malformed_payload',
            level: 'warn',
            message: 'Scraper payload missing suggestion arrays.',
            context: {
              targetCategory,
              genderPreference,
            },
          });

          return buildFallbackSuggestions({
            occasion: params.occasion,
            targetCategory,
            genderPreference,
            filters,
            wardrobe,
            reason: 'Scraper returned malformed data. Showing fallback suggestions.',
          });
        }

        const normalizedSuggestions = rawSuggestions.map((item: any, index: number) => {
          const fallbackTarget = targetCategory === 'both' ? (index % 2 === 0 ? 'topwear' : 'bottomwear') : targetCategory;
          return normalizeLiveSuggestion(item, fallbackTarget, genderPreference);
        });

        const ranked = rankAndFilterSuggestions({
          suggestions: normalizedSuggestions,
          filters,
          targetCategory,
          genderPreference,
          maxResults,
        });

        if (ranked.length === 0) {
          logScrapeEvent({
            type: 'scrape_low_results',
            level: 'warn',
            message: 'All live scraped suggestions were filtered out.',
            context: {
              targetCategory,
              genderPreference,
            },
          });

          return buildFallbackSuggestions({
            occasion: params.occasion,
            targetCategory,
            genderPreference,
            filters,
            wardrobe,
            reason: 'No scraped items matched your filters. Showing fallback suggestions.',
          });
        }

        const withProviderFallback =
          ranked.length < Math.min(maxResults, SCRAPER_MIN_RESULTS)
            ? createProviderFallbackSuggestions({
                occasion: params.occasion,
                targetCategory,
                genderPreference,
                filters,
                wardrobe,
                maxResults,
                seedSuggestions: ranked,
              })
            : ranked;

        if (ranked.length < Math.min(maxResults, SCRAPER_MIN_RESULTS)) {
          logScrapeEvent({
            type: 'scrape_low_results',
            level: 'warn',
            message: 'Low live result count detected; provider fallback strategy applied.',
            context: {
              liveResults: ranked.length,
              minResults: SCRAPER_MIN_RESULTS,
              finalResults: withProviderFallback.length,
              targetCategory,
            },
          });
        }

        return {
          occasion: String((liveSuggestions as any).occasion ?? params.occasion),
          target_category: targetCategory,
          gender_preference: genderPreference,
          search_filters: filters,
          suggestions: withProviderFallback,
          error: (liveSuggestions as any).error,
        };
      } catch (error) {
        if (isAbortRequestError(error)) {
          logScrapeEvent({
            type: 'scrape_timeout',
            level: 'warn',
            message: 'Scraper request timed out.',
            context: {
              timeoutMs: SCRAPER_TIMEOUT_MS,
              targetCategory,
              genderPreference,
              error: error instanceof Error ? error.message : String(error),
            },
          });

          return buildFallbackSuggestions({
            occasion: params.occasion,
            targetCategory,
            genderPreference,
            filters,
            wardrobe,
            reason: `Scraper request timed out after ${Math.round(SCRAPER_TIMEOUT_MS / 1000)}s. Showing fallback suggestions.`,
          });
        }

        logScrapeEvent({
          type: 'scrape_request_failed',
          level: 'error',
          message: 'Scraper request failed unexpectedly.',
          context: {
            targetCategory,
            genderPreference,
            error: error instanceof Error ? error.message : String(error),
          },
        });

        const errorText = error instanceof Error ? error.message.trim() : '';
        const reason = errorText.length > 0
          ? `Live scraper request failed (${errorText}). Showing fallback suggestions.`
          : 'Live scraper request failed. Showing fallback suggestions.';

        return buildFallbackSuggestions({
          occasion: params.occasion,
          targetCategory,
          genderPreference,
          filters,
          wardrobe,
          reason,
        });
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    return buildFallbackSuggestions({
      occasion: params.occasion,
      targetCategory,
      genderPreference,
      filters,
      wardrobe,
      reason: 'Live scraping is disabled in mock mode. Showing ranked fallback suggestions.',
    });
  } catch (error) {
    throw new Error(toUserFacingApiMessage(error, 'Failed to fetch shopping suggestions'));
  }
}
