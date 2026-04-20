/*
  # AI Wardrobe Assistant Database Schema

  ## Overview
  Complete database schema for an AI-powered wardrobe assistant that handles clothing classification,
  outfit matching, and personalized recommendations.

  ## New Tables

  ### 1. `clothing_items`
  Stores user's wardrobe items with AI-classified attributes
  - `id` (uuid, primary key) - Unique identifier for each clothing item
  - `user_id` (uuid, foreign key) - References auth.users
  - `category` (text) - Classified category (T-shirt, Shirt, Jeans, Shorts, Jacket, Dress, Coat, Skirt)
  - `item_type` (text) - Either 'topwear' or 'bottomwear'
  - `color` (text) - Dominant color detected
  - `pattern` (text) - Pattern type (solid, striped, checkered, floral, printed, denim)
  - `sleeve_type` (text) - Sleeve classification (sleeveless, short, 3/4, full, N/A)
  - `style_tags` (text array) - Style descriptors
  - `confidence` (float) - ML classification confidence score (0.0-1.0)
  - `image_url` (text) - Storage path for clothing image
  - `embedding` (vector(512)) - Feature vector for similarity matching
  - `created_at` (timestamptz) - Upload timestamp

  ### 2. `outfits`
  Stores matched outfit combinations with compatibility scores
  - `id` (uuid, primary key) - Unique outfit identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `top_item_id` (uuid, foreign key) - References clothing_items
  - `bottom_item_id` (uuid, foreign key) - References clothing_items
  - `compatibility_score` (float) - Overall compatibility percentage (0-100)
  - `style_match_score` (float) - Embedding similarity component
  - `color_harmony_score` (float) - Color compatibility component
  - `occasion_fit_score` (float) - Occasion appropriateness component
  - `occasion` (text) - Target occasion (party, formal, casual, interview, wedding)
  - `created_at` (timestamptz) - When outfit was created

  ### 3. `recommendations`
  Tracks recommendation history for analytics and personalization
  - `id` (uuid, primary key) - Unique recommendation identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `seed_item_id` (uuid, foreign key, nullable) - Item that triggered recommendation
  - `suggested_item_data` (jsonb) - External product data or internal item reference
  - `match_score` (float) - Compatibility score with seed item or wardrobe
  - `source` (text) - Source type ('wardrobe' or 'shopping')
  - `occasion` (text, nullable) - Context if occasion-based
  - `created_at` (timestamptz) - Recommendation timestamp

  ### 4. `user_preferences`
  Stores user style preferences and settings
  - `user_id` (uuid, primary key) - References auth.users
  - `favorite_colors` (text array) - Preferred colors
  - `style_profile` (text) - Inferred style (casual, formal, streetwear, etc.)
  - `sizes` (jsonb) - Size preferences per category
  - `occasions` (text array) - Frequently used occasions
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Authenticated access required for all operations
  - Policies enforce data isolation by user_id

  ## Extensions
  - pgvector for embedding storage and similarity search
*/

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Clothing Items Table
CREATE TABLE IF NOT EXISTS clothing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL CHECK (category IN ('T-shirt', 'Shirt', 'Jeans', 'Shorts', 'Jacket', 'Dress', 'Coat', 'Skirt')),
  item_type text NOT NULL CHECK (item_type IN ('topwear', 'bottomwear')),
  color text,
  pattern text,
  sleeve_type text,
  style_tags text[] DEFAULT '{}',
  confidence float CHECK (confidence >= 0 AND confidence <= 1),
  image_url text NOT NULL,
  embedding vector(512),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX IF NOT EXISTS idx_clothing_items_item_type ON clothing_items(item_type);
CREATE INDEX IF NOT EXISTS idx_clothing_items_category ON clothing_items(category);
CREATE INDEX IF NOT EXISTS idx_clothing_items_embedding ON clothing_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE clothing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clothing items"
  ON clothing_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clothing items"
  ON clothing_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clothing items"
  ON clothing_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clothing items"
  ON clothing_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Outfits Table
CREATE TABLE IF NOT EXISTS outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  top_item_id uuid REFERENCES clothing_items(id) ON DELETE CASCADE NOT NULL,
  bottom_item_id uuid REFERENCES clothing_items(id) ON DELETE CASCADE NOT NULL,
  compatibility_score float NOT NULL CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  style_match_score float DEFAULT 0,
  color_harmony_score float DEFAULT 0,
  occasion_fit_score float DEFAULT 0,
  occasion text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outfits_user_id ON outfits(user_id);
CREATE INDEX IF NOT EXISTS idx_outfits_score ON outfits(compatibility_score DESC);

ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outfits"
  ON outfits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outfits"
  ON outfits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outfits"
  ON outfits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own outfits"
  ON outfits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Recommendations Table
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seed_item_id uuid REFERENCES clothing_items(id) ON DELETE SET NULL,
  suggested_item_data jsonb NOT NULL,
  match_score float NOT NULL,
  source text NOT NULL CHECK (source IN ('wardrobe', 'shopping')),
  occasion text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at DESC);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations"
  ON recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations"
  ON recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recommendations"
  ON recommendations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_colors text[] DEFAULT '{}',
  style_profile text,
  sizes jsonb DEFAULT '{}',
  occasions text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Helper function to find similar clothing items using vector similarity
CREATE OR REPLACE FUNCTION find_similar_items(
  query_embedding vector(512),
  query_user_id uuid,
  opposite_type text DEFAULT NULL,
  limit_count int DEFAULT 10
)
RETURNS TABLE (
  item_id uuid,
  category text,
  color text,
  image_url text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    clothing_items.category,
    clothing_items.color,
    clothing_items.image_url,
    1 - (embedding <=> query_embedding) as similarity
  FROM clothing_items
  WHERE 
    user_id = query_user_id
    AND embedding IS NOT NULL
    AND (opposite_type IS NULL OR item_type = opposite_type)
  ORDER BY embedding <=> query_embedding
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;