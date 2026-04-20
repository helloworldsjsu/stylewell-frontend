/*
  # Multimodal Outfit Embeddings + Personalization Tables
*/

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.garment_items
ADD COLUMN IF NOT EXISTS item_type TEXT,
ADD COLUMN IF NOT EXISTS fashion_embedding vector(512),
ADD COLUMN IF NOT EXISTS embedding_model TEXT,
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_garment_items_item_type
ON public.garment_items(item_type);

CREATE INDEX IF NOT EXISTS idx_garment_items_fashion_embedding
ON public.garment_items
USING hnsw (fashion_embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS public.user_outfit_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  occasion TEXT,
  outfit_item_ids UUID[] NOT NULL,
  action TEXT CHECK (action IN ('like', 'dislike', 'save', 'wear', 'skip')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_outfit_feedback_user_id
ON public.user_outfit_feedback(user_id);

CREATE TABLE IF NOT EXISTS public.user_style_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_embedding vector(512),
  style_tags JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_outfit_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_style_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own outfit feedback" ON public.user_outfit_feedback;
CREATE POLICY "Users can view own outfit feedback"
ON public.user_outfit_feedback
FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own outfit feedback" ON public.user_outfit_feedback;
CREATE POLICY "Users can insert own outfit feedback"
ON public.user_outfit_feedback
FOR INSERT
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can view own style profile" ON public.user_style_profiles;
CREATE POLICY "Users can view own style profile"
ON public.user_style_profiles
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upsert own style profile" ON public.user_style_profiles;
CREATE POLICY "Users can upsert own style profile"
ON public.user_style_profiles
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own style profile" ON public.user_style_profiles;
CREATE POLICY "Users can update own style profile"
ON public.user_style_profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
