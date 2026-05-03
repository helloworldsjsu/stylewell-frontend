import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import type { ClothingItem, ScoredOutfit } from '../_shared/types.ts';
import { MIN_SCORE_THRESHOLD, getWeights, scoreCompatibility } from '../_shared/scoring.ts';
import { analyzeWardrobeGapsWithAI, scoreOutfitWithAI } from '../_shared/ai.ts';

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
  occasion: string,
  hasLockedItem: boolean,
): Promise<ScoredOutfit[]> {
  const rough = pairs.map(({ top, bottom }) => scoreCompatibility(top, bottom, occasion, getWeights(occasion, hasLockedItem)));
  const shortlisted = rough
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

    if (req.method === 'POST' && pathname.endsWith('/occasion')) {
      const body = await req.json();
      const occasion = body?.occasion as string;
      const lockedTopId = body?.locked_top_id as string | undefined;
      const lockedBottomId = body?.locked_bottom_id as string | undefined;

      if (!occasion) {
        return jsonResponse({ error: 'occasion is required' }, 400);
      }

      const { data: wardrobe, error } = await supabase
        .from('garment_items')
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

      const recommended = outfits[0] ?? null;
      if (!recommended) {
        return jsonResponse({ error: 'No outfit recommendations found' }, 400);
      }

      const alternatives = outfits.slice(1, 3);
      // ============================================
      // AI_PLACEHOLDER
      // Replace this with: Send the full wardrobe item list + occasion to your model.
      // Expected response shape: { suggestions: [{ category, color, pattern, reason, matches_with_ids[] }] }
      // ============================================
      const gapAnalysis = await analyzeWardrobeGapsWithAI(items, occasion);

      await supabase.from('outfits').insert({
        user_id: user.id,
        top_id: recommended.top.id,
        bottom_id: recommended.bottom.id,
        compatibility_score: recommended.score,
        color_score: recommended.breakdown.color,
        style_score: recommended.breakdown.style,
        occasion_score: recommended.breakdown.occasion,
        occasion,
        ai_reason: recommended.ai_reason,
        ai_tip: recommended.ai_tip,
      });

      if (gapAnalysis.suggestions.length > 0) {
        await supabase.from('shopping_suggestions').insert(
          gapAnalysis.suggestions.map((suggestion) => ({
            user_id: user.id,
            category: suggestion.category,
            color: suggestion.color,
            pattern: suggestion.pattern,
            reason: suggestion.reason,
            matches_with: suggestion.matches_with_ids,
            occasion,
          })),
        );
      }

      const formatOutfit = (outfit: ScoredOutfit, rank: number) => ({
        rank,
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
      });

      return jsonResponse({
        recommended_outfit: formatOutfit(recommended, 1),
        alternatives: alternatives.map((outfit, index) => formatOutfit(outfit, index + 2)),
        shopping_suggestions: gapAnalysis.suggestions.map((suggestion) => ({
          category: suggestion.category,
          color: suggestion.color,
          pattern: suggestion.pattern,
          reason: suggestion.reason,
          search_query: `${suggestion.color} ${suggestion.pattern} ${suggestion.category}`,
        })),
      });
    }

    if (req.method === 'GET' && pathname.endsWith('/history')) {
      const { data, error } = await supabase
        .from('outfits')
        .select(
          `
          id,
          compatibility_score,
          color_score,
          style_score,
          occasion_score,
          occasion,
          ai_reason,
          ai_tip,
          created_at,
          top:clothing_items!outfits_top_id_fkey(id, category, color, image_url),
          bottom:clothing_items!outfits_bottom_id_fkey(id, category, color, image_url)
        `,
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return jsonResponse({ history: data ?? [] });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
