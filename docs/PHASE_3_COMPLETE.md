# Phase 3 Complete: Database + SQL + Auth

Status: completed

## Completed scope

### 3.1 Schema and migrations
- SQL migrations ported into child repo.
- Required schema objects recreated for garments, outfits, config, and suggestions.
- Idempotency and rollback notes documented.

### 3.2 Auth restoration
- Supabase auth/session restoration enabled.
- Route guards and redirect behavior restored.
- Sign-up/sign-in/sign-out error handling parity added.

### 3.3 Persistence layer
- Local mock storage replaced with DB-backed garment persistence.
- Image upload reconnected to Supabase Storage bucket flow.
- Outfit history save/retrieval re-enabled from DB.

### 3.4 Security and env hardening
- Credentials/config moved to env-driven setup.
- RLS verification checklist documented.
- Auth + DB smoke test script added.

## Classification + DB integration

Classification remains integrated with persistence:
- Classification is performed in frontend flow via API classification endpoint in live mode.
- User-edited classification metadata is persisted with uploaded image in DB/storage.

## Validation status

Validated in local workspace:
- `npm run typecheck`
- `npm run build`

Smoke command added for connected environments:
- `npm run smoke:auth-db`
