# Phase 3.3 Persistence Layer

Status: completed

## Delivered

- Replaced local mock/localStorage garment persistence with Supabase-backed queries.
- Reconnected image upload to Supabase Storage bucket `clothing-images`.
- Re-enabled outfit history save and retrieval via `outfits` table.

## Implementation Details

### Garment Persistence (DB-backed)

Updated `src/lib/supabase.ts` to:
- Fetch garments from `garment_items` table (`getGarmentItems`).
- Update garment description in DB (`updateGarmentItem`).
- Delete garment rows from DB and remove corresponding storage object (`deleteGarmentItem`).
- Parse and normalize stored description payloads safely.
- Resolve storage paths to signed URLs for rendering in UI.

### Storage Upload Flow

Updated `saveGarmentWithClassification` to:
- Require authenticated user.
- Upload image file to `clothing-images` bucket in user-scoped path (`{userId}/{timestamp}_{file}`).
- Save metadata row to `garment_items` table.
- Return hydrated item with signed image URL.

### Outfit History Persistence

Added in `src/lib/supabase.ts`:
- `saveOutfitHistoryRecord(...)`
- `getOutfitHistory()`

Rewired callers:
- `src/store/outfitStore.ts` now saves outfits to DB instead of localStorage.
- `src/api/recommendations.ts` now retrieves history from DB.
- `src/api/client.ts` history helper now returns DB-backed history.

## Validation

Executed successfully:

```bash
npm run typecheck
npm run build
```

## Notes

- Auth is required for persistence operations.
- If `garment_items.user_id` is absent in a deployed schema variant, garment insert gracefully retries without `user_id`.
- Outfit save/retrieval includes compatibility handling for `top_id/bottom_id` and legacy `top_item_id/bottom_item_id` field variants.
