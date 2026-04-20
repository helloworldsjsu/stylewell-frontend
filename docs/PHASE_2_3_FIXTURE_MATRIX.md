# Phase 2.3 Fixture Matrix

Use this matrix to validate normalization behavior during manual/API smoke testing.

## Case A - default recommendations
- Input: `recommendations` array with > 5 outfits in mixed order
- Expected:
  - Sorted descending by `score`
  - Clipped to top 5
  - Re-ranked `1..5`

## Case B - locked top only
- Input: `case=B` with recommendations list
- Expected:
  - Scenario resolves to `locked_top` or `locked_top+occasion`
  - Top item remains consistent across returned outfits

## Case C - locked bottom only
- Input: `case=C` with recommendations list
- Expected:
  - Scenario resolves to `locked_bottom` or `locked_bottom+occasion`
  - Bottom item remains consistent across returned outfits

## Case D - both locked, selected outfit only
- Input: `case=D` with `selected_outfit_score` and empty/no `recommendations`
- Expected:
  - One normalized outfit returned
  - Uses locked top/bottom items
  - Score and breakdown normalized to 0..100

## Missing/partial breakdown values
- Input: missing `breakdown.style` or `breakdown.occasion`
- Expected:
  - Missing values default to 0
  - No UI crash

## Invalid score values
- Input: `score="91"`, `score="N/A"`, `score=140`, `score=-9`
- Expected:
  - Numeric strings parsed
  - Invalid values default to 0
  - Values clamped to `0..100`

## Gap analysis suggestions
- Input: empty/malformed `suggestions`
- Expected:
  - Normalized `shopping_suggestions` is safe array
  - Missing fields get defaults
