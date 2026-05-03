import { createClient } from '@supabase/supabase-js';
import { inferWardrobeSlot } from './wardrobeSlots';
import type { OutfitHistoryResponse, ScoredOutfit } from '../types/wardrobe';

type GarmentDescription = {
  type: string;
  category: string;
  color: string;
  pattern: string;
  fabric: string;
  fit: string;
  occasion: string;
  season: string;
};

type StoredGarmentItem = {
  id: string;
  user_id?: string;
  image_url: string;
  description: GarmentDescription;
  created_at: string;
};

const CONFIGURED_STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET;
const STORAGE_BUCKET_CANDIDATES = [CONFIGURED_STORAGE_BUCKET, 'clothing-images', 'garments']
  .filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index)
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
// Keep signed URLs within conservative limits for broad Supabase compatibility.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
let cachedWritableStorageBucket: string | null = null;

function inferDescriptionFromFile(fileName: string): GarmentDescription {
  const slot = inferWardrobeSlot(fileName);
  return {
    type: slot === 'bottomwear' ? 'Trousers' : slot === 'topwear' ? 'Shirt' : 'Accessory',
    category: slot === 'bottomwear' ? 'Bottomwear' : slot === 'topwear' ? 'Topwear' : 'Others',
    color: 'Navy',
    pattern: 'Solid',
    fabric: 'Cotton',
    fit: 'Regular',
    occasion: 'Casual',
    season: 'All Season',
  };
}

export const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL || 'ui-only-local';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MISSING_ENV_ERROR =
  'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

type SupabaseLike = any;

const fallbackSupabase: any = {
  from: () => {
    throw new Error(MISSING_ENV_ERROR);
  },
  auth: {
    getSession: async () => {
      throw new Error(MISSING_ENV_ERROR);
    },
    signUp: async () => {
      throw new Error(MISSING_ENV_ERROR);
    },
    signInWithPassword: async () => {
      throw new Error(MISSING_ENV_ERROR);
    },
    signOut: async () => {
      throw new Error(MISSING_ENV_ERROR);
    },
    onAuthStateChange: () => ({
      data: {
        subscription: {
          unsubscribe: () => undefined,
        },
      },
    }),
  },
  storage: {
    from: () => {
      throw new Error(MISSING_ENV_ERROR);
    },
  },
};

const client = hasSupabaseEnv
  ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'x-client-info': 'stylewell-frontend@1.0.0',
        },
      },
    })
  : fallbackSupabase;

export const supabase: SupabaseLike | any = client;

export function hasSupabaseAuthEnv(): boolean {
  return hasSupabaseEnv;
}

export function getSupabaseClient(): SupabaseLike {
  if (!hasSupabaseEnv) {
    throw new Error(MISSING_ENV_ERROR);
  }

  return client as SupabaseLike;
}

async function requireAuthUser() {
  const supabaseClient = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) {
    throw new Error(error.message || 'Failed to read authenticated user');
  }

  if (!user) {
    throw new Error('You must be signed in to continue');
  }

  return user;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isExternalUrl(value: string): boolean {
  return /^https?:\/\//.test(value) || value.startsWith('data:');
}

function normalizeHfSpaceHost(hostname: string): string {
  // Common misconfig: "<owner>-<space>.space" instead of "<owner>-<space>.hf.space".
  if (/^[a-z0-9-]+\.space$/i.test(hostname)) {
    return hostname.replace(/\.space$/i, '.hf.space');
  }
  return hostname;
}

function normalizeApiUrl(value: string): string {
  const trimmed = value.trim();
  const withPortSlash = trimmed.replace(/^(https?:\/\/[^/\s:]+:\d+)(?=[a-z])/i, '$1/');
  const parsed = new URL(withPortSlash);
  parsed.hostname = normalizeHfSpaceHost(parsed.hostname);
  return parsed.href.replace(/\/$/, '');
}

async function resolveImageUrl(rawPathOrUrl: string): Promise<string> {
  if (!rawPathOrUrl || isExternalUrl(rawPathOrUrl)) {
    return rawPathOrUrl;
  }

  const supabaseClient = getSupabaseClient();
  for (const bucket of STORAGE_BUCKET_CANDIDATES) {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(rawPathOrUrl, SIGNED_URL_TTL_SECONDS);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  return rawPathOrUrl;
}

async function getWritableStorageBucket(): Promise<string> {
  if (cachedWritableStorageBucket) {
    return cachedWritableStorageBucket;
  }

  const fallback = STORAGE_BUCKET_CANDIDATES[0] ?? 'clothing-images';
  cachedWritableStorageBucket = fallback;
  return fallback;
}

async function uploadWithBucketFallback(params: {
  supabaseClient: SupabaseLike;
  storagePath: string;
  file: File;
  contentType: string;
}): Promise<string> {
  let lastError: unknown = null;

  for (const bucket of STORAGE_BUCKET_CANDIDATES) {
    const { error } = await params.supabaseClient.storage
      .from(bucket)
      .upload(params.storagePath, params.file, {
        contentType: params.contentType,
        upsert: false,
      });

    if (!error) {
      cachedWritableStorageBucket = bucket;
      return bucket;
    }

    lastError = error;
    const errorText = String(error.message ?? error).toLowerCase();
    if (errorText.includes('bucket not found')) {
      continue;
    }

    throw new Error(error.message || 'Failed to upload image to storage');
  }

  const message =
    typeof (lastError as any)?.message === 'string'
      ? (lastError as any).message
      : 'Failed to upload image to storage';
  throw new Error(message);
}

function parseDescription(value: unknown): GarmentDescription {
  if (value && typeof value === 'object') {
    return value as GarmentDescription;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as GarmentDescription;
    } catch {
      return inferDescriptionFromFile('unknown');
    }
  }
  return inferDescriptionFromFile('unknown');
}

async function insertGarmentRow(payload: {
  image_url: string;
  description: GarmentDescription;
  user_id?: string;
}) {
  const supabaseClient = getSupabaseClient();

  const withUserResponse = await supabaseClient
    .from('garment_items')
    .insert([
      {
        image_url: payload.image_url,
        description: payload.description,
        user_id: payload.user_id,
      },
    ])
    .select('*')
    .single();

  if (!withUserResponse.error) {
    return withUserResponse;
  }

  if (!withUserResponse.error.message.toLowerCase().includes('user_id')) {
    return withUserResponse;
  }

  return supabaseClient
    .from('garment_items')
    .insert([
      {
        image_url: payload.image_url,
        description: payload.description,
      },
    ])
    .select('*')
    .single();
}

const LOCAL_FLASK_FALLBACK_URL = 'http://127.0.0.1:5000';
let cachedFlaskApiUrl: string | null = null;
let cachedFlaskApiUrlAt = 0;
const FLASK_API_URL_CACHE_TTL_MS = 60_000;

export const getFlaskApiUrl = async (): Promise<string> => {
  const envUrl = import.meta.env.VITE_FLASK_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && /^https?:\/\//.test(envUrl)) {
    try {
      return normalizeApiUrl(envUrl);
    } catch {
      // Fall through to dynamic config/local fallback when env URL is malformed.
    }
  }

  const now = Date.now();
  if (cachedFlaskApiUrl && now - cachedFlaskApiUrlAt < FLASK_API_URL_CACHE_TTL_MS) {
    return cachedFlaskApiUrl;
  }

  if (hasSupabaseEnv) {
    try {
      const supabaseClient = getSupabaseClient();
      const { data, error } = await supabaseClient
        .from('app_config')
        .select('value')
        .eq('key', 'flask_api_url')
        .maybeSingle();

      if (!error && typeof data?.value === 'string' && /^https?:\/\//.test(data.value)) {
        try {
          const resolved = normalizeApiUrl(data.value);
          cachedFlaskApiUrl = resolved;
          cachedFlaskApiUrlAt = now;
          return resolved;
        } catch {
          // Ignore malformed DB-configured URL and fall back below.
        }
      }
    } catch {
      // Fallback below handles missing table/policies/network failures.
    }
  }

  return LOCAL_FLASK_FALLBACK_URL;
};

export const getImageUrl = (path: string) => path;

export const uploadGarmentImage = async (file: File) => {
  const classification = inferDescriptionFromFile(file.name);
  return saveGarmentWithClassification(file, classification);
};

export const getGarmentItems = async () => {
  const user = await requireAuthUser();
  const supabaseClient = getSupabaseClient();

  const { data, error } = await supabaseClient
    .from('garment_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to fetch garment items');
  }

  const filtered = (data ?? []).filter((item: any) => !item.user_id || item.user_id === user.id);
  const hydrated = await Promise.all(
    filtered.map(async (item: any) => ({
      ...item,
      description: parseDescription(item.description),
      image_url: await resolveImageUrl(String(item.image_url ?? '')),
    })),
  );

  return { items: hydrated };
};

export const deleteGarmentItem = async (itemId: string) => {
  await requireAuthUser();
  const supabaseClient = getSupabaseClient();
  const bucket = await getWritableStorageBucket();

  const { data: row, error: fetchError } = await supabaseClient
    .from('garment_items')
    .select('image_url')
    .eq('id', itemId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message || 'Failed to resolve garment before deletion');
  }

  if (row?.image_url && !isExternalUrl(String(row.image_url))) {
    await supabaseClient.storage.from(bucket).remove([String(row.image_url)]);
  }

  const { error } = await supabaseClient.from('garment_items').delete().eq('id', itemId);
  if (error) {
    throw new Error(error.message || 'Failed to delete garment item');
  }

  return { success: true };
};

export const updateGarmentItem = async (itemId: string, classification: Partial<GarmentDescription>) => {
  await requireAuthUser();
  const supabaseClient = getSupabaseClient();

  const { data: existing, error: readError } = await supabaseClient
    .from('garment_items')
    .select('description')
    .eq('id', itemId)
    .single();

  if (readError) {
    throw new Error(readError.message || 'Failed to read garment for update');
  }

  const mergedDescription = {
    ...parseDescription(existing?.description),
    ...classification,
  };

  const { error: updateError } = await supabaseClient
    .from('garment_items')
    .update({ description: mergedDescription })
    .eq('id', itemId);

  if (updateError) {
    throw new Error(updateError.message || 'Failed to update garment item');
  }

  return { success: true };
};

export const saveGarmentWithClassification = async (
  file: File,
  classification: Partial<GarmentDescription>,
) => {
  const user = await requireAuthUser();
  const supabaseClient = getSupabaseClient();

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const storagePath = `${user.id}/${Date.now()}_${sanitizeFileName(baseName)}.${extension}`;
  const bucket = await uploadWithBucketFallback({
    supabaseClient,
    storagePath,
    file,
    contentType: file.type || 'image/jpeg',
  });

  const fullDescription: GarmentDescription = {
    ...inferDescriptionFromFile(file.name),
    ...classification,
  };

  const { data, error } = await insertGarmentRow({
    image_url: storagePath,
    description: fullDescription,
    user_id: user.id,
  });

  if (error || !data) {
    await supabaseClient.storage.from(bucket).remove([storagePath]);
    throw new Error(error?.message || 'Failed to save garment metadata');
  }

  const signedUrl = await resolveImageUrl(storagePath);
  const item: StoredGarmentItem = {
    id: String((data as any).id),
    user_id: (data as any).user_id ?? user.id,
    image_url: signedUrl,
    description: {
      ...fullDescription,
      type: fullDescription.type || 'Shirt',
      category: fullDescription.category || 'Others',
      color: fullDescription.color || 'Unknown',
      pattern: fullDescription.pattern || 'Solid',
      fabric: fullDescription.fabric || 'Cotton',
      fit: fullDescription.fit || 'Regular',
      occasion: fullDescription.occasion || 'Casual',
      season: fullDescription.season || 'All Season',
    },
    created_at: String((data as any).created_at ?? new Date().toISOString()),
  };

  return item;
};

export async function saveOutfitHistoryRecord(params: {
  outfit: ScoredOutfit;
  occasion: string | null;
}) {
  if (!params.outfit.top?.id || !params.outfit.bottom?.id) {
    throw new Error('Saving standalone Others outfits is not supported in history yet.');
  }

  const user = await requireAuthUser();
  const supabaseClient = getSupabaseClient();

  const insertPayload = {
    user_id: user.id,
    top_id: params.outfit.top.id,
    bottom_id: params.outfit.bottom.id,
    compatibility_score: params.outfit.score,
    color_score: params.outfit.breakdown.color,
    style_score: params.outfit.breakdown.style,
    occasion_score: params.outfit.breakdown.occasion,
    occasion: params.occasion,
    ai_reason: params.outfit.ai_reason,
    ai_tip: params.outfit.ai_tip,
  };

  const { error } = await supabaseClient.from('outfits').insert(insertPayload);
  if (!error) {
    return { success: true };
  }

  if (!error.message.toLowerCase().includes('top_id')) {
    throw new Error(error.message || 'Failed to save outfit history');
  }

  const legacyPayload = {
    user_id: user.id,
    top_item_id: params.outfit.top.id,
    bottom_item_id: params.outfit.bottom.id,
    compatibility_score: params.outfit.score,
    color_harmony_score: params.outfit.breakdown.color,
    style_match_score: params.outfit.breakdown.style,
    occasion_fit_score: params.outfit.breakdown.occasion,
    occasion: params.occasion,
  };

  const { error: legacyError } = await supabaseClient.from('outfits').insert(legacyPayload);
  if (legacyError) {
    throw new Error(legacyError.message || 'Failed to save outfit history');
  }

  return { success: true };
}

export async function getOutfitHistory(): Promise<OutfitHistoryResponse> {
  const user = await requireAuthUser();
  const supabaseClient = getSupabaseClient();

  const { data: outfits, error: outfitError } = await supabaseClient
    .from('outfits')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (outfitError) {
    throw new Error(outfitError.message || 'Failed to fetch outfit history');
  }

  const itemIds = Array.from(
    new Set(
      (outfits ?? [])
        .flatMap((outfit: any) => [outfit.top_id ?? outfit.top_item_id, outfit.bottom_id ?? outfit.bottom_item_id])
        .filter(Boolean),
    ),
  );

  const itemMap = new Map<string, any>();
  if (itemIds.length > 0) {
    const { data: items } = await supabaseClient
      .from('garment_items')
      .select('id, image_url, description')
      .in('id', itemIds as string[]);

    await Promise.all(
      (items ?? []).map(async (item: any) => {
        const description = parseDescription(item.description);
        itemMap.set(String(item.id), {
          id: String(item.id),
          category: description.category ?? description.type ?? 'Unknown',
          color: description.color ?? 'Unknown',
          image_url: await resolveImageUrl(String(item.image_url ?? '')),
        });
      }),
    );
  }

  const history = (outfits ?? []).map((entry: any) => {
    const topId = entry.top_id ?? entry.top_item_id;
    const bottomId = entry.bottom_id ?? entry.bottom_item_id;

    return {
      id: String(entry.id),
      compatibility_score: Number(entry.compatibility_score ?? 0),
      color_score: Number(entry.color_score ?? entry.color_harmony_score ?? 0),
      style_score: Number(entry.style_score ?? entry.style_match_score ?? 0),
      occasion_score: Number(entry.occasion_score ?? entry.occasion_fit_score ?? 0),
      occasion: String(entry.occasion ?? 'casual'),
      ai_reason: String(entry.ai_reason ?? ''),
      ai_tip: String(entry.ai_tip ?? ''),
      created_at: String(entry.created_at ?? new Date().toISOString()),
      top: topId ? itemMap.get(String(topId)) ?? null : null,
      bottom: bottomId ? itemMap.get(String(bottomId)) ?? null : null,
    };
  });

  return { history };
}
