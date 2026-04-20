import type { ClothingItem, ScoredOutfit, Weights } from './types.ts';

export const MIN_SCORE_THRESHOLD = 40;

const NEUTRALS = new Set(['black', 'white', 'grey', 'beige', 'navy', 'cream', 'tan']);

const COMPLEMENTARY_PAIRS = new Set([
  'navy|white',
  'black|white',
  'grey|black',
  'beige|brown',
  'olive|khaki',
  'white|grey',
  'black|beige',
  'navy|beige',
]);

const ANALOGOUS_PAIRS = new Set([
  'blue|navy',
  'red|pink',
  'green|olive',
  'brown|beige',
  'grey|white',
  'teal|blue',
  'burgundy|red',
  'mustard|yellow',
]);

const CLASHING_PAIRS = new Set([
  'red|orange',
  'pink|red',
  'green|blue',
  'purple|orange',
  'yellow|purple',
  'red|green',
  'orange|blue',
]);

const FORMALITY_MAP: Record<string, number> = {
  't-shirt': 1,
  shorts: 1,
  'tank-top': 1,
  'crop-top': 1,
  jeans: 2,
  hoodie: 2,
  sweatshirt: 2,
  shirt: 3,
  chinos: 3,
  skirt: 3,
  dress: 3,
  trousers: 4,
  blazer: 4,
  coat: 4,
  'dress (formal)': 4,
  suit: 5,
};

const OCCASION_CATEGORY_SCORES: Record<string, Record<string, number>> = {
  interview: { shirt: 100, trousers: 100, blazer: 100, jeans: 60, 't-shirt': 20, shorts: 5, dress: 90, coat: 85 },
  party: { 't-shirt': 90, jeans: 90, dress: 100, shirt: 80, blazer: 85, shorts: 75, skirt: 90, coat: 50 },
  casual: { 't-shirt': 100, jeans: 100, shorts: 95, shirt: 80, hoodie: 100, dress: 75, skirt: 80 },
  formal: { suit: 100, blazer: 95, trousers: 95, dress: 95, shirt: 85, 't-shirt': 10, shorts: 5, jeans: 40 },
  wedding: { suit: 100, dress: 100, blazer: 90, trousers: 90, shirt: 80, jeans: 30, 't-shirt': 15, shorts: 5 },
};

function normalize(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function pairKey(a?: string | null, b?: string | null): string {
  const n1 = normalize(a);
  const n2 = normalize(b);
  return [n1, n2].sort().join('|');
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function colorHarmonyScore(colorA: string, colorB: string): number {
  const a = normalize(colorA);
  const b = normalize(colorB);

  if (!a || !b) {
    return 55;
  }
  if (a === b) {
    return 65;
  }
  if (NEUTRALS.has(a) || NEUTRALS.has(b)) {
    return 80;
  }

  const key = pairKey(a, b);
  if (COMPLEMENTARY_PAIRS.has(key)) {
    return 92;
  }
  if (ANALOGOUS_PAIRS.has(key)) {
    return 72;
  }
  if (CLASHING_PAIRS.has(key)) {
    return 25;
  }

  return 55;
}

export function formalityLevel(category: string): number {
  return FORMALITY_MAP[normalize(category)] ?? 2;
}

function inferSleeveLength(sleeveType?: string | null): 'short' | 'long' | 'unknown' {
  const sleeve = normalize(sleeveType);
  if (sleeve.includes('short')) {
    return 'short';
  }
  if (sleeve.includes('long')) {
    return 'long';
  }
  return 'unknown';
}

function isSolidPattern(pattern?: string | null): boolean {
  const p = normalize(pattern);
  return !p || p === 'solid' || p === 'plain';
}

export function styleSimilarityScore(top: ClothingItem, bottom: ClothingItem): number {
  let score = 50;

  const formalityDiff = Math.abs(formalityLevel(top.category) - formalityLevel(bottom.category));
  if (formalityDiff === 0) {
    score += 30;
  } else if (formalityDiff === 1) {
    score += 10;
  } else if (formalityDiff === 2) {
    score -= 10;
  } else {
    score -= 25;
  }

  const topSolid = isSolidPattern(top.pattern);
  const bottomSolid = isSolidPattern(bottom.pattern);

  if (!topSolid && !bottomSolid) {
    score -= 15;
  }
  if (topSolid && bottomSolid) {
    score += 10;
  }

  const topSleeve = inferSleeveLength(top.sleeve_type);
  const bottomSleeve = inferSleeveLength(bottom.sleeve_type);
  if (topSleeve !== 'unknown' && topSleeve === bottomSleeve) {
    score += 10;
  }

  return clamp(score);
}

export function occasionFitScore(top: ClothingItem, bottom: ClothingItem, occasion: string): number {
  const occasionKey = normalize(occasion) || 'casual';
  const scores = OCCASION_CATEGORY_SCORES[occasionKey] ?? OCCASION_CATEGORY_SCORES.casual;

  const topScore = scores[normalize(top.category)] ?? 50;
  const bottomScore = scores[normalize(bottom.category)] ?? 50;

  return (topScore + bottomScore) / 2;
}

export function getWeights(occasion?: string, hasLockedItem?: boolean): Weights {
  const occasionKey = normalize(occasion);
  if (occasionKey && occasionKey !== 'casual') {
    return { color: 0.3, style: 0.35, occasion: 0.35 };
  }
  if (hasLockedItem) {
    return { color: 0.4, style: 0.4, occasion: 0.2 };
  }
  return { color: 0.35, style: 0.45, occasion: 0.2 };
}

export function scoreCompatibility(
  top: ClothingItem,
  bottom: ClothingItem,
  occasion?: string,
  weights?: Weights,
): ScoredOutfit {
  const breakdown = {
    color: colorHarmonyScore(top.color, bottom.color),
    style: styleSimilarityScore(top, bottom),
    occasion: occasionFitScore(top, bottom, occasion ?? 'casual'),
  };

  const appliedWeights = weights ?? getWeights(occasion, false);
  const total =
    breakdown.color * appliedWeights.color +
    breakdown.style * appliedWeights.style +
    breakdown.occasion * appliedWeights.occasion;

  return {
    top,
    bottom,
    score: Math.round(total * 10) / 10,
    breakdown,
    ai_reason: 'Rule-based score used',
    ai_tip: 'Try adding a neutral accessory to balance the outfit.',
  };
}
