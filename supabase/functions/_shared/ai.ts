import type { ClothingItem } from './types.ts';

type WardrobeModelTask = 'outfit_scoring' | 'gap_analysis';

export interface AIScoreResponse {
  score: number;
  color_score: number;
  style_score: number;
  occasion_score: number;
  reason: string;
  tip: string;
}

export interface AIGapAnalysisResponse {
  suggestions: Array<{
    category: string;
    color: string;
    pattern: string;
    reason: string;
    matches_with_ids: string[];
  }>;
}

function buildOutfitScoringPrompt(occasion?: string): string {
  return [
    'You are a wardrobe stylist model.',
    `Task: score outfit compatibility for occasion "${occasion ?? 'casual'}".`,
    'Return strict JSON only with keys: score, color_score, style_score, occasion_score, reason, tip.',
    'All scores must be numbers between 0 and 100.',
  ].join(' ');
}

function buildGapAnalysisPrompt(occasion?: string): string {
  return [
    'You are a wardrobe stylist model.',
    `Task: analyze wardrobe gaps for occasion "${occasion ?? 'casual'}" and suggest items to buy.`,
    'Return strict JSON only with key suggestions.',
    'Each suggestion must include: category, color, pattern, reason, matches_with_ids.',
  ].join(' ');
}

async function callWardrobeModel<T>(
  task: WardrobeModelTask,
  prompt: string,
  payload: unknown,
  mockResponse: T,
): Promise<T> {
  void task;
  void prompt;
  void payload;

  // ============================================
  // AI_PLACEHOLDER
  // Replace this with: Single shared {MODEL_NAME} API call for all wardrobe AI tasks.
  // Input to model: { task, prompt, payload }
  // Expected response shape: task-dependent JSON matching T.
  // ============================================

  // HARDCODED MOCK - remove when integrating real model
  return mockResponse;
}

// ============================================
// AI_PLACEHOLDER
// Replace this with: Send top and bottom item attributes + occasion to your model.
// Expected response shape: { score, color_score, style_score, occasion_score, reason, tip }
// ============================================
export async function scoreOutfitWithAI(
  top: ClothingItem,
  bottom: ClothingItem,
  occasion?: string,
): Promise<AIScoreResponse> {
  const prompt = buildOutfitScoringPrompt(occasion);
  const payload = {
    top,
    bottom,
    occasion: occasion ?? 'casual',
  };

  const mockResponse: AIScoreResponse = {
    score: 82,
    color_score: 88,
    style_score: 79,
    occasion_score: 80,
    reason:
      `The ${top.color} ${top.category} pairs well with the ${bottom.color} ${bottom.category}. ` +
      `The formality levels are well matched for ${occasion ?? 'casual'} wear.`,
    tip: `Consider adding a ${top.color.toLowerCase() === 'white' ? 'brown' : 'black'} belt to complete the look.`,
  };

  return callWardrobeModel<AIScoreResponse>('outfit_scoring', prompt, payload, mockResponse);
}

// ============================================
// AI_PLACEHOLDER
// Replace this with: Send full wardrobe item list + occasion to your model.
// Expected response shape: { suggestions: [{ category, color, pattern, reason, matches_with_ids[] }] }
// ============================================
export async function analyzeWardrobeGapsWithAI(
  wardrobe: ClothingItem[],
  occasion?: string,
): Promise<AIGapAnalysisResponse> {
  const prompt = buildGapAnalysisPrompt(occasion);
  const payload = {
    wardrobe,
    occasion: occasion ?? 'casual',
  };

  const mockResponse: AIGapAnalysisResponse = {
    suggestions: [
      {
        category: 'Trousers',
        color: 'navy',
        pattern: 'solid',
        reason: 'Would complement 70% of your existing tops',
        matches_with_ids: wardrobe.filter((i) => i.type === 'topwear').slice(0, 3).map((i) => i.id),
      },
      {
        category: 'Shirt',
        color: 'white',
        pattern: 'solid',
        reason: 'A white shirt is a wardrobe essential that pairs with everything',
        matches_with_ids: wardrobe.filter((i) => i.type === 'bottomwear').slice(0, 3).map((i) => i.id),
      },
    ],
  };

  return callWardrobeModel<AIGapAnalysisResponse>('gap_analysis', prompt, payload, mockResponse);
}
