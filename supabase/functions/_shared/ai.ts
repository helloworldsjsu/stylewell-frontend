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

function buildOutfitScoringPrompt(top: ClothingItem, bottom: ClothingItem, occasion?: string): string {
  const occasionText = occasion ?? 'casual';
  return JSON.stringify({
    task: 'outfit_scoring',
    occasion: occasionText,
    top: {
      category: top.category,
      color: top.color,
      pattern: top.pattern,
      occasion: top.occasion,
    },
    bottom: {
      category: bottom.category,
      color: bottom.color,
      pattern: bottom.pattern,
      occasion: bottom.occasion,
    },
    instructions: [
      'Evaluate this outfit combination critically based on fashion principles.',
      'Consider color harmony, style coordination, and occasion appropriateness.',
      'Vary your scores - not all outfits deserve high scores.',
      'Return JSON with: score (0-100), color_score (0-100), style_score (0-100), occasion_score (0-100), reason (1-2 sentences), tip (actionable advice)',
    ].join(' '),
  }, null, 2);
}

async function callNvidiaBackend(
  top: ClothingItem,
  bottom: ClothingItem,
  occasion?: string,
): Promise<AIScoreResponse> {
  const BACKEND_URL = Deno.env.get('STYLEWELL_BACKEND_URL') || 'https://aman4014-StyleWellBackend.hf.space';

  try {
    // Use your existing backend's scoring logic
    const response = await fetch(`${BACKEND_URL}/ai/score-outfit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        top,
        bottom,
        occasion: occasion ?? 'casual',
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`Backend scoring failed: ${response.status}`);
    }

    const data = await response.json();
    return data as AIScoreResponse;
  } catch (error) {
    console.error('[AI] Backend scoring failed:', error);
    throw error;
  }
}

function generateVariedScore(
  top: ClothingItem,
  bottom: ClothingItem,
  occasion?: string,
): AIScoreResponse {
  const occasionLower = (occasion ?? 'casual').toLowerCase();

  // Color scoring with variation
  const topColor = top.color.toLowerCase();
  const bottomColor = bottom.color.toLowerCase();

  let colorScore = 70;
  if (topColor === bottomColor) {
    colorScore = Math.floor(78 + Math.random() * 10); // 78-87
  } else if (
    (topColor.includes('white') && bottomColor.includes('black')) ||
    (topColor.includes('black') && bottomColor.includes('white')) ||
    (topColor.includes('navy') && bottomColor.includes('white'))
  ) {
    colorScore = Math.floor(82 + Math.random() * 12); // 82-93
  } else {
    const neutrals = ['white', 'black', 'grey', 'gray', 'beige', 'navy', 'cream'];
    const topNeutral = neutrals.some(n => topColor.includes(n));
    const bottomNeutral = neutrals.some(n => bottomColor.includes(n));
    if (topNeutral && bottomNeutral) {
      colorScore = Math.floor(74 + Math.random() * 12); // 74-85
    } else if (topNeutral || bottomNeutral) {
      colorScore = Math.floor(68 + Math.random() * 14); // 68-81
    } else {
      colorScore = Math.floor(55 + Math.random() * 20); // 55-74
    }
  }

  // Style scoring with variation
  const topCat = top.category.toLowerCase();
  const bottomCat = bottom.category.toLowerCase();

  let styleScore = 70;
  if (/(shirt|blazer|blouse)/.test(topCat) && /(trouser|pant|slack)/.test(bottomCat)) {
    styleScore = Math.floor(84 + Math.random() * 12); // 84-95
  } else if (/(t-shirt|tee|polo)/.test(topCat) && /(jean|chino)/.test(bottomCat)) {
    styleScore = Math.floor(78 + Math.random() * 14); // 78-91
  } else if (/(kurta|sherwani)/.test(topCat) && /(churidar|pyjama)/.test(bottomCat)) {
    styleScore = Math.floor(86 + Math.random() * 10); // 86-95
  } else {
    const topFormal = /(shirt|blazer|blouse)/.test(topCat);
    const bottomCasual = /(jean|short)/.test(bottomCat);
    const topCasual = /(t-shirt|tee|hoodie|sweatshirt)/.test(topCat);
    const bottomFormal = /(trouser|slack)/.test(bottomCat);

    if ((topFormal && bottomCasual) || (topCasual && bottomFormal)) {
      styleScore = Math.floor(50 + Math.random() * 20); // 50-69 (style clash)
    } else {
      styleScore = Math.floor(68 + Math.random() * 16); // 68-83
    }
  }

  // Occasion scoring with variation
  const combinedCat = `${topCat} ${bottomCat}`;
  const formalBoost = /(blazer|shirt|trouser|pant|slack|blouse)/.test(combinedCat);
  const casualBoost = /(t-shirt|tee|jean|chino)/.test(combinedCat);
  const ethnicBoost = /(kurta|sherwani|churidar)/.test(combinedCat);

  let occasionScore = 70;

  if (occasionLower === 'formal' || occasionLower === 'interview' || occasionLower === 'wedding') {
    if (formalBoost) {
      occasionScore = Math.floor(80 + Math.random() * 14); // 80-93
    } else if (casualBoost) {
      occasionScore = Math.floor(38 + Math.random() * 18); // 38-55 (too casual)
    } else {
      occasionScore = Math.floor(58 + Math.random() * 16); // 58-73
    }
  } else if (occasionLower === 'party' || occasionLower === 'evening') {
    if (ethnicBoost || formalBoost) {
      occasionScore = Math.floor(78 + Math.random() * 16); // 78-93
    } else if (casualBoost) {
      occasionScore = Math.floor(52 + Math.random() * 18); // 52-69
    } else {
      occasionScore = Math.floor(70 + Math.random() * 14); // 70-83
    }
  } else {
    // Casual
    if (casualBoost) {
      occasionScore = Math.floor(76 + Math.random() * 16); // 76-91
    } else if (formalBoost) {
      occasionScore = Math.floor(62 + Math.random() * 18); // 62-79 (overdressed)
    } else {
      occasionScore = Math.floor(68 + Math.random() * 16); // 68-83
    }
  }

  // Check occasion compatibility
  const topOccasion = (top.occasion ?? '').toLowerCase();
  const bottomOccasion = (bottom.occasion ?? '').toLowerCase();
  const requestedOccasion = occasionLower;

  const isTopCompatible = !topOccasion ||
    topOccasion === requestedOccasion ||
    topOccasion.includes(requestedOccasion) ||
    (requestedOccasion === 'formal' && topOccasion.includes('work')) ||
    (requestedOccasion === 'casual' && topOccasion.includes('everyday'));

  const isBottomCompatible = !bottomOccasion ||
    bottomOccasion === requestedOccasion ||
    bottomOccasion.includes(requestedOccasion) ||
    (requestedOccasion === 'formal' && bottomOccasion.includes('work')) ||
    (requestedOccasion === 'casual' && bottomOccasion.includes('everyday'));

  if (!isTopCompatible || !isBottomCompatible) {
    occasionScore = Math.max(5, Math.floor(occasionScore * 0.25)); // 75% penalty
  }

  const score = Math.round((colorScore + styleScore + occasionScore) / 3);

  const reasons = [
    `The ${top.color.toLowerCase()} ${top.category.toLowerCase()} ${colorScore > 80 ? 'complements' : 'pairs with'} the ${bottom.color.toLowerCase()} ${bottom.category.toLowerCase()}`,
    styleScore > 80 ? 'with excellent style coordination' : styleScore > 65 ? 'creating a balanced look' : 'though the formality levels differ slightly',
    occasionScore > 75 ? `perfect for ${occasionLower}` : occasionScore > 60 ? `suitable for ${occasionLower}` : `but may not be ideal for ${occasionLower}`,
  ];

  const tips = [
    colorScore < 70 ? 'Try pairing with more neutral colors for better balance.' : '',
    styleScore < 70 ? 'Consider matching formality levels for better coordination.' : '',
    occasionScore < 70 ? `This combination works better for ${casualBoost ? 'casual' : 'formal'} occasions.` : '',
    'Add complementary accessories to complete the look.',
  ].filter(t => t.length > 0);

  return {
    score,
    color_score: colorScore,
    style_score: styleScore,
    occasion_score: occasionScore,
    reason: reasons.join(', ') + '.',
    tip: tips[Math.floor(Math.random() * tips.length)] || 'Complete this outfit with matching footwear.',
  };
}

export async function scoreOutfitWithAI(
  top: ClothingItem,
  bottom: ClothingItem,
  occasion?: string,
): Promise<AIScoreResponse> {
  try {
    // Try backend first - uses NVIDIA-enhanced scoring
    return await callNvidiaBackend(top, bottom, occasion);
  } catch (error) {
    console.error('[AI] Backend scoring failed, using fallback:', error);
    // Fall back to varied rule-based scoring
    return generateVariedScore(top, bottom, occasion);
  }
}

export async function analyzeWardrobeGapsWithAI(
  wardrobe: ClothingItem[],
  occasion?: string,
): Promise<AIGapAnalysisResponse> {
  // Mock implementation for now
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

  return mockResponse;
}
