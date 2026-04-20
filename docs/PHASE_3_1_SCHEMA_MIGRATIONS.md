# Phase 3.1 Schema and Migrations Completion

Status: completed

## Scope Completed

Phase 3.1 required:
1. Port SQL migration files into child repo
2. Recreate tables/buckets for garments, outfits, config, and suggestions
3. Verify migration idempotency and rollback notes

All three are now completed in the child repository.

## Migration Files in Child Repo

- supabase/migrations/20260227102337_create_wardrobe_schema.sql
- supabase/migrations/20260227102404_setup_storage_buckets.sql
- supabase/migrations/003_outfits_and_suggestions.sql
- supabase/migrations/20260304233951_update_to_garment_items_schema.sql
- supabase/migrations/20260305_create_config_table.sql
- supabase/migrations/20260320000000_phase3_1_recreate_outfits_and_suggestions.sql

## Object Coverage Matrix

- Garments table: public.garment_items
  - Source: 20260304233951_update_to_garment_items_schema.sql
- Outfits table: public.outfits
  - Source: 003_outfits_and_suggestions.sql
  - Recreated/idempotent guard migration: 20260320000000_phase3_1_recreate_outfits_and_suggestions.sql
- Suggestions table: public.shopping_suggestions
  - Source: 003_outfits_and_suggestions.sql
  - Recreated/idempotent guard migration: 20260320000000_phase3_1_recreate_outfits_and_suggestions.sql
- Config table: public.app_config
  - Source: 20260305_create_config_table.sql
- Storage bucket: storage.buckets(id = 'clothing-images')
  - Source: 20260227102404_setup_storage_buckets.sql
  - Re-ensured with ON CONFLICT guard in: 20260320000000_phase3_1_recreate_outfits_and_suggestions.sql

## Idempotency Verification Notes

Idempotent safeguards now present:
- CREATE TABLE IF NOT EXISTS for all core tables
- CREATE INDEX IF NOT EXISTS for helper indexes
- INSERT ... ON CONFLICT DO NOTHING for storage bucket and config seed
- DROP POLICY IF EXISTS before CREATE POLICY in the Phase 3.1 follow-up migration

Important caveat:
- Some legacy migrations include CREATE POLICY without an IF NOT EXISTS guard.
- In normal Supabase migration flow this is safe because each migration runs once and is tracked.
- For manual re-runs outside migration tracking, run rollback SQL first, then re-apply.

## Rollback Notes (Manual)

Run in reverse dependency order:

```sql
-- Optional: remove policy objects first if needed
DROP POLICY IF EXISTS "Users can delete own shopping suggestions" ON public.shopping_suggestions;
DROP POLICY IF EXISTS "Users can insert own shopping suggestions" ON public.shopping_suggestions;
DROP POLICY IF EXISTS "Users can view own shopping suggestions" ON public.shopping_suggestions;
DROP POLICY IF EXISTS "Users can delete own outfits" ON public.outfits;
DROP POLICY IF EXISTS "Users can insert own outfits" ON public.outfits;
DROP POLICY IF EXISTS "Users can view own outfits" ON public.outfits;

-- Drop dependent tables
DROP TABLE IF EXISTS public.shopping_suggestions CASCADE;
DROP TABLE IF EXISTS public.outfits CASCADE;

-- Optional cleanup
DROP TABLE IF EXISTS public.app_config CASCADE;
DROP TABLE IF EXISTS public.garment_items CASCADE;

-- Optional storage cleanup (destructive)
DELETE FROM storage.objects WHERE bucket_id = 'clothing-images';
DELETE FROM storage.buckets WHERE id = 'clothing-images';
```

## Practical Verification Commands

After linking the child repo to Supabase project:

```bash
supabase db push
supabase db lint
```

Then verify objects exist:

```sql
SELECT to_regclass('public.garment_items');
SELECT to_regclass('public.outfits');
SELECT to_regclass('public.shopping_suggestions');
SELECT to_regclass('public.app_config');
SELECT id FROM storage.buckets WHERE id = 'clothing-images';
```
