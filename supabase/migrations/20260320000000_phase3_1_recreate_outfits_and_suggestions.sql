/*
  # Phase 3.1: Recreate Outfits + Suggestions for Child Repo

  ## Purpose
  Ensures schema coverage for:
  - garments (already in public.garment_items)
  - outfits (public.outfits)
  - suggestions (public.shopping_suggestions)
  - config (already in public.app_config)
  - storage bucket (clothing-images)

  This migration is intentionally idempotent.
*/

-- Recreate outfits table compatible with garment_items
CREATE TABLE IF NOT EXISTS public.outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  top_id UUID REFERENCES public.garment_items(id) ON DELETE SET NULL,
  bottom_id UUID REFERENCES public.garment_items(id) ON DELETE SET NULL,
  compatibility_score FLOAT,
  color_score FLOAT,
  style_score FLOAT,
  occasion_score FLOAT,
  occasion TEXT,
  ai_reason TEXT,
  ai_tip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outfits_created_at ON public.outfits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outfits_user_id ON public.outfits(user_id);

-- Recreate shopping suggestions table
CREATE TABLE IF NOT EXISTS public.shopping_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  category TEXT,
  color TEXT,
  pattern TEXT,
  reason TEXT,
  matches_with TEXT[],
  occasion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_suggestions_created_at
ON public.shopping_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_suggestions_user_id
ON public.shopping_suggestions(user_id);

-- RLS enablement
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_suggestions ENABLE ROW LEVEL SECURITY;

-- Idempotent policy recreation for outfits
DROP POLICY IF EXISTS "Users can view own outfits" ON public.outfits;
CREATE POLICY "Users can view own outfits"
ON public.outfits
FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own outfits" ON public.outfits;
CREATE POLICY "Users can insert own outfits"
ON public.outfits
FOR INSERT
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete own outfits" ON public.outfits;
CREATE POLICY "Users can delete own outfits"
ON public.outfits
FOR DELETE
USING (user_id = auth.uid() OR user_id IS NULL);

-- Idempotent policy recreation for shopping suggestions
DROP POLICY IF EXISTS "Users can view own shopping suggestions" ON public.shopping_suggestions;
CREATE POLICY "Users can view own shopping suggestions"
ON public.shopping_suggestions
FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own shopping suggestions" ON public.shopping_suggestions;
CREATE POLICY "Users can insert own shopping suggestions"
ON public.shopping_suggestions
FOR INSERT
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete own shopping suggestions" ON public.shopping_suggestions;
CREATE POLICY "Users can delete own shopping suggestions"
ON public.shopping_suggestions
FOR DELETE
USING (user_id = auth.uid() OR user_id IS NULL);

-- Ensure clothing image bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clothing-images',
  'clothing-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
