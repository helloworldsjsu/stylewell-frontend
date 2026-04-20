-- Saved outfits
CREATE TABLE IF NOT EXISTS public.outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  top_id UUID REFERENCES public.clothing_items(id) ON DELETE CASCADE,
  bottom_id UUID REFERENCES public.clothing_items(id) ON DELETE CASCADE,
  compatibility_score FLOAT,
  color_score FLOAT,
  style_score FLOAT,
  occasion_score FLOAT,
  occasion TEXT,
  ai_reason TEXT,
  ai_tip TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Shopping suggestions
CREATE TABLE IF NOT EXISTS public.shopping_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  category TEXT,
  color TEXT,
  pattern TEXT,
  reason TEXT,
  matches_with TEXT[],
  occasion TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own outfits" ON public.outfits;
CREATE POLICY "Users can view own outfits"
ON public.outfits
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own outfits" ON public.outfits;
CREATE POLICY "Users can insert own outfits"
ON public.outfits
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own shopping suggestions" ON public.shopping_suggestions;
CREATE POLICY "Users can view own shopping suggestions"
ON public.shopping_suggestions
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own shopping suggestions" ON public.shopping_suggestions;
CREATE POLICY "Users can insert own shopping suggestions"
ON public.shopping_suggestions
FOR INSERT
WITH CHECK (user_id = auth.uid());
