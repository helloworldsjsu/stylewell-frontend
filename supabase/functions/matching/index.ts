import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import type { ClothingItem, ScoredOutfit } from '../_shared/types.ts';
import { MIN_SCORE_THRESHOLD, getWeights, scoreCompatibility } from '../_shared/scoring.ts';
import { scoreOutfitWithAI } from '../_shared/ai.ts';

function scenarioLabel(occasion?: string, lockedTop?: ClothingItem | null, lockedBottom?: ClothingItem | null): string {
  const parts: string[] = [];
  if (lockedTop) parts.push('locked_top');
  if (lockedBottom) parts.push('locked_bottom');
  if (occasion) parts.push('occasion');
  return parts.length ? parts.join('+') : 'default';
}

function normalizeItem(item: any): ClothingItem {
  // Extract description field which may contain occasion info
  let description: any = {};
  if (typeof item.description === 'string') {
    try {
      description = JSON.parse(item.description);
    } catch {
      description = {};
    }
  } else if (item.description && typeof item.description === 'object') {
    description = item.description;
  }

  return {
    id: item.id,
    user_id: item.user_id,
    image_url: item.image_url,
    category: item.category || description.category,
    color: item.color || description.color,
    pattern: item.pattern || description.pattern,
    sleeve_type: item.sleeve_type || description.sleeve_type,
    type: item.type || item.item_type || description.type,
    confidence_score: item.confidence_score || item.confidence,
    created_at: item.created_at,
    occasion: description.occasion || null,
  };
}

function buildPairs(
  tops: ClothingItem[],
  bottoms: ClothingItem[],
  lockedTop?: ClothingItem | null,
  lockedBottom?: ClothingItem | null,
): Array<{ top: ClothingItem; bottom: ClothingItem }> {
  if (lockedTop && lockedBottom) {
    return [{ top: lockedTop, bottom: lockedBottom }];
  }

  const useTops = lockedTop ? [lockedTop] : tops;
  const useBottoms = lockedBottom ? [lockedBottom] : bottoms;

  const pairs: Array<{ top: ClothingItem; bottom: ClothingItem }> = [];
  for (const top of useTops) {
    for (const bottom of useBottoms) {
      pairs.push({ top, bottom });
    }
  }
  return pairs;
}

async function scorePipeline(
  pairs: Array<{ top: ClothingItem; bottom: ClothingItem }>,
  occasion?: string,
  hasLockedItem = false,
): Promise<ScoredOutfit[]> {
  const weights = getWeights(occasion, hasLockedItem);

  const roughScored = pairs.map(({ top, bottom }) => scoreCompatibility(top, bottom, occasion, weights));
  const shortlisted = roughScored
    .filter((outfit) => outfit.score >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const aiScored = await Promise.all(
    shortlisted.map(async (outfit) => {
      try {
        // ============================================
        // AI_PLACEHOLDER
        // Replace this with: Send top and bottom attributes + optional occasion to your model.
        // Expected response shape: { score, color_score, style_score, occasion_score, reason, tip }
        // ============================================
        const ai = await scoreOutfitWithAI(outfit.top, outfit.bottom, occasion);
        return {
          ...outfit,
          score: ai.score,
          breakdown: {
            color: ai.color_score,
            style: ai.style_score,
            occasion: ai.occasion_score,
          },
          ai_reason: ai.reason,
          ai_tip: ai.tip,
        };
      } catch {
        return outfit;
      }
    }),
  );

  return aiScored.sort((a, b) => b.score - a.score).slice(0, 5);
}

async function getAuthedUser(supabase: ReturnType<typeof createClient>, authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const user = await getAuthedUser(supabase, req.headers.get('Authorization'));
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === 'GET' && pathname.endsWith('/wardrobe')) {
      const occasion = url.searchParams.get('occasion') ?? undefined;
      const lockedTopId = url.searchParams.get('locked_top_id') ?? undefined;
      const lockedBottomId = url.searchParams.get('locked_bottom_id') ?? undefined;

      const { data: wardrobe, error } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items = (wardrobe ?? []).map(normalizeItem);
      const tops = items.filter((i: ClothingItem) => i.type === 'topwear');
      const bottoms = items.filter((i: ClothingItem) => i.type === 'bottomwear');

      const lockedTop = lockedTopId ? tops.find((i: ClothingItem) => i.id === lockedTopId) ?? null : null;
      const lockedBottom = lockedBottomId ? bottoms.find((i: ClothingItem) => i.id === lockedBottomId) ?? null : null;

      const pairs = buildPairs(tops, bottoms, lockedTop, lockedBottom);
      const outfits = await scorePipeline(pairs, occasion, Boolean(lockedTop || lockedBottom));

      return jsonResponse({
        outfits: outfits.map((outfit, index) => ({
          rank: index + 1,
          score: outfit.score,
          breakdown: outfit.breakdown,
          ai_reason: outfit.ai_reason,
          ai_tip: outfit.ai_tip,
          top: {
            id: outfit.top.id,
            category: outfit.top.category,
            color: outfit.top.color,
            image_url: outfit.top.image_url,
          },
          bottom: {
            id: outfit.bottom.id,
            category: outfit.bottom.category,
            color: outfit.bottom.color,
            image_url: outfit.bottom.image_url,
          },
        })),
        total_combinations_checked: pairs.length,
        scenario: scenarioLabel(occasion, lockedTop, lockedBottom),
      });
    }

    if (req.method === 'POST' && pathname.endsWith('/new-item')) {
      const body = await req.json();
      const imageBase64 = body?.image_base64 as string | undefined;
      const occasion = body?.occasion as string | undefined;

      if (!imageBase64) {
        return jsonResponse({ error: 'image_base64 is required' }, 400);
      }

      const { data: wardrobe, error } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items = (wardrobe ?? []).map(normalizeItem);

      // ============================================
      // AI_PLACEHOLDER
      // Replace this with: Send image_base64 to vision model for clothing classification.
      // Expected response shape: { id, image_url, category, color, pattern, sleeve_type, type }
      // ============================================
      const newItem: ClothingItem = {
        id: 'preview-item-id',
        image_url: 'preview://new-item',
        category: 'Shirt',
        color: 'white',
        pattern: 'solid',
        sleeve_type: 'long sleeve',
        type: 'topwear',
      };

      const tops = newItem.type === 'topwear' ? [newItem] : items.filter((i: ClothingItem) => i.type === 'topwear');
      const bottoms = newItem.type === 'bottomwear' ? [newItem] : items.filter((i: ClothingItem) => i.type === 'bottomwear');

      const pairs = buildPairs(tops, bottoms);
      const outfits = await scorePipeline(pairs, occasion, false);

      return jsonResponse({
        outfits: outfits.map((outfit, index) => ({
          rank: index + 1,
          score: outfit.score,
          breakdown: outfit.breakdown,
          ai_reason: outfit.ai_reason,
          ai_tip: outfit.ai_tip,
          top: {
            id: outfit.top.id,
            category: outfit.top.category,
            color: outfit.top.color,
            image_url: outfit.top.image_url,
          },
          bottom: {
            id: outfit.bottom.id,
            category: outfit.bottom.category,
            color: outfit.bottom.color,
            image_url: outfit.bottom.image_url,
          },
        })),
        total_combinations_checked: pairs.length,
        scenario: `new_item${occasion ? '+occasion' : ''}`,
      });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
