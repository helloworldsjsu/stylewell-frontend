# Phase 4.2 Suggestion Ranking and Filtering

Status: completed

## Delivered

- Reconnected filter payloads for colors, patterns, fabrics, fits, styles, seasons, include, and exclude keywords.
- Re-enabled gender preference and target category routing with explicit filtering.
- Reconciled live scraped response schema variants into a stable UI-ready suggestion shape.

## Implementation

Updated file:
- src/api/client.ts

### Ranking and filter behavior

- Added filter-aware ranking layer with deterministic ordering.
- Applied target-category routing:
  - `both` keeps both item types
  - `topwear` keeps topwear only
  - `bottomwear` keeps bottomwear only
- Applied gender routing:
  - strict match for `women`, `men`, `unisex`
  - `unknown` values allowed as neutral fallback
- Applied include/exclude keyword logic:
  - include tokens boost ranking
  - exclude tokens reject candidate

### Schema reconciliation

Live scraper payload is normalized from alternate key shapes such as:
- `suggestions` / `results` / `items`
- `match_score` / `score` / `compatibility`
- `title` / `name` / `product_title`
- `url` / `product_url` / `link`
- `image_url` / `image` / `imageUrl`
- `product_gender` / `gender`

All outputs are normalized into `ScrapedShoppingSuggestion` before UI consumption.

### Fallback continuity

If live results are malformed or filtered to empty, fallback suggestions are generated and ranked with the same filter/routing logic so UI behavior remains consistent.

## Validation

Executed successfully:

```bash
npm run typecheck
npm run build
```
