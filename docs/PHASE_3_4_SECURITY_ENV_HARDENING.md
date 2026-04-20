# Phase 3.4 Security + Environment Hardening

Status: completed

## 1) Credentials moved to env vars

All runtime credentials/config values are now environment-driven.

Required keys:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET`
- `VITE_API_MODE`
- `VITE_API_BASE_URL`

Optional smoke keys:
- `SMOKE_TEST_EMAIL`
- `SMOKE_TEST_PASSWORD`

Updated files:
- `.env.example`
- `src/lib/supabase.ts`
- `supabase/migrations/20260305_create_config_table.sql`

## 2) RLS policy verification checklist

Run these checks in SQL editor after migrations are applied.

### Core table RLS enabled
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('garment_items', 'outfits', 'shopping_suggestions', 'app_config')
ORDER BY tablename;
```

Expected: `rowsecurity = true` for all listed tables.

### Public policy surface audit
```sql
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND tablename IN ('garment_items', 'outfits', 'shopping_suggestions', 'app_config', 'objects')
ORDER BY schemaname, tablename, policyname;
```

Review checklist:
- `outfits` policies must enforce `user_id = auth.uid()`.
- `shopping_suggestions` policies must enforce `user_id = auth.uid()`.
- `storage.objects` policies for `clothing-images` must be user-folder scoped.
- `app_config` read policy is intentionally public in current architecture.

### Policy behavior sanity checks
- Anonymous user cannot mutate `outfits` rows for another user.
- Authenticated user can insert/view only their own `outfits` rows.
- Authenticated user can upload/delete only files under `<uid>/` path in `clothing-images`.

## 3) Smoke tests for auth + DB integration

A smoke script is included:
- `scripts/smoke-auth-db.mjs`

Run:
```bash
npm run smoke:auth-db
```

What it verifies:
- Supabase environment keys are present.
- Auth session access works (`getSession`).
- Optional password sign-in works (if `SMOKE_TEST_EMAIL` and `SMOKE_TEST_PASSWORD` are provided).
- DB connectivity for `garment_items`, `outfits`, and `app_config`.
- Storage bucket existence for configured bucket.

## 4) Classification + DB integration note

Classification is integrated and persisted:
- Classification response is produced by API client classify flow.
- User-confirmed classification is saved with uploaded image metadata to DB/storage.

Relevant paths:
- `src/api/client.ts`
- `src/components/UploadModal.tsx`
- `src/lib/supabase.ts`
