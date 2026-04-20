# Wardrobe Assistant Child

Wardrobe Assistant Child is a web application for managing a personal wardrobe, generating outfit recommendations, and suggesting products to fill wardrobe gaps.

The project includes:
- a React + TypeScript frontend (this repository root),
- Supabase integration for auth, storage, and relational data,
- an external FastAPI backend for classification, outfit scoring, and shopping suggestion logic.

## Key Features

- Authenticated wardrobe management
- Image upload and garment metadata ingestion
- Outfit recommendation workflows with lock-based item constraints
- Occasion-aware suggestion flows with resilient fallback behavior
- Profile-aware API mode (`mock` and `live`) for local and integrated development

## Tech Stack

Frontend:
- React 18
- TypeScript
- Vite
- React Router
- Zustand
- Tailwind CSS

Platform and backend integration:
- Supabase (Auth, Postgres, Storage)
- External FastAPI backend (see `wardrobe-backend/`)

Testing and quality:
- Vitest
- ESLint
- TypeScript type checking

## Project Structure

```text
src/
  api/          API contracts, request wrappers, normalizers, matching/suggestion clients
  components/   Reusable UI components
  config/       Runtime API configuration
  contexts/     Auth/session context
  lib/          Supabase client and utility helpers
  pages/        Route-level screens
  store/        Zustand stores
  types/        Shared TypeScript models

scripts/
  smoke-auth-db.mjs   Supabase auth/db/storage smoke check

supabase/
  functions/     Edge functions and shared logic
  migrations/    SQL schema migrations

wardrobe-backend/
  FastAPI backend intended for Hugging Face deployment
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the repository root and provide the variables you use.

Minimum for integrated (`live`) mode:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=https://<your-backend>.hf.space
```

Optional variables:

```env
VITE_API_MODE=live
VITE_FLASK_API_URL=https://<your-backend>.hf.space
VITE_SUPABASE_STORAGE_BUCKET=clothing-images
SMOKE_TEST_EMAIL=...
SMOKE_TEST_PASSWORD=...
```

Notes:
- If neither Supabase credentials nor API base URL is configured, the app defaults to `mock` mode.
- The API URL normalizer handles common Hugging Face host misconfiguration (`.space` to `.hf.space`).

### 3. Start development server

```bash
npm run dev
```

### 4. Build for production

```bash
npm run build
npm run preview
```

## Available Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - create production build
- `npm run preview` - preview production build locally
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks
- `npm run test` - run all Vitest tests
- `npm run test:api` - run API-focused tests
- `npm run test:e2e` - run flow/e2e tests
- `npm run smoke:auth-db` - verify Supabase auth, DB tables, and storage bucket access

## Backend Integration

The website is designed to call an external backend for AI and recommendation endpoints.

Expected backend endpoint families include:
- `/classify`, `/upload`
- `/items` CRUD
- `/ai/recommend-outfits`, `/ai/score-outfit`, `/ai/gap-analysis`
- `/suggestions` and related shopping routes

Backend deployment details are documented in:
- `wardrobe-backend/README.md`

## Deployment

Frontend deployment is compatible with static hosts (for example Vercel).

This repository includes a rewrite rule in `vercel.json`:
- all routes are rewritten to `index.html` to support SPA routing.

Typical deployment flow:
1. Set frontend environment variables in your hosting platform.
2. Ensure backend URL points to your live backend service.
3. Deploy the frontend build.

## Operational Guidance

- Keep all API keys and service credentials in environment variables.
- Run `npm run typecheck`, `npm run lint`, and `npm run test` before release.
- Use `npm run smoke:auth-db` after changing Supabase configuration or migrations.

## Documentation

Implementation and rollout details are available under `docs/`, including architecture phases, schema updates, and recommendation pipeline changes.
