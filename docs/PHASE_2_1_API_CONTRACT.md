# Phase 2.1 - API Contract and Routing

Status: complete for Phase 2

## Objective

Introduce a typed API contract layer and environment-driven routing so the child repo can switch between:
- mock mode (current UI-only behavior)
- live mode (real backend endpoints)

## Runtime Config

- `VITE_API_MODE`: `mock` | `live`
- `VITE_API_BASE_URL`: backend base URL (for live mode)

## Standard Error Envelope

Frontend route calls normalize server failures into:

```json
{
  "error": "Human readable message",
  "code": "OPTIONAL_CODE",
  "details": {}
}
```

## Route Map (Phase 2.1)

- `POST /classify`
- `POST /upload`
- `GET /items`
- `DELETE /items/:item_id`
- `POST /ai/recommend-outfits`
- `POST /ai/gap-analysis`
- `POST /suggestions`

## Next Work in Phase 2

- 2.2 Classification integration hardening and payload validation
  - Implemented initial hardening pass:
    - Shared `validateImageFile` guard for upload/classify paths
    - Classification response normalization with safe defaults
    - Wardrobe item payload normalization for malformed backend data
    - Upload modal pre-flight file validation for user feedback
- 2.3 Outfit recommendation response normalization
  - Implemented initial response normalization pass:
    - Centralized scored-outfit normalization for both `outfits` and `recommendations` payload variants
    - Deterministic sorting and top-5 clipping for matching results
    - Scenario inference fallback based on lock/occasion context
    - Unified occasion recommendation normalization with gap-analysis suggestion normalization
- 2.4 API integration test coverage and retry strategy
  - Completed:
    - Shared HTTP retry/backoff for transient 429/5xx and network failures
    - User-facing API error mapping for actionable UI messages
    - API-focused automated tests for:
      - HTTP retry/error behavior
      - Classification/wardrobe payload normalization
      - Recommendation normalization and locked-scenario fallback

## Verification Commands

```bash
npm run test:api
npm run typecheck
npm run build
```
