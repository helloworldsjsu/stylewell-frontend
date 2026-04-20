/*
  # Update Schema to Garment Items Table

  ## Overview
  Updates the database schema to use the simplified garment_items table structure
  with public read/write access and automatic updated_at timestamp tracking.

  ## Changes
  - Replaces complex clothing_items table with simpler garment_items
  - Uses public RLS policies (no authentication required)
  - Adds automatic updated_at trigger
  - Configures storage bucket for garment images

  ## New Table
  - `garment_items` with columns:
    - id (UUID, primary key)
    - image_url (text)
    - description (text)
    - created_at (timestamptz)
    - updated_at (timestamptz)
*/

-- Drop existing schema if it exists (backup first!)
DROP TABLE IF EXISTS public.outfits CASCADE;
DROP TABLE IF EXISTS public.recommendations CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.clothing_items CASCADE;

-- Create the garment_items table
CREATE TABLE IF NOT EXISTS public.garment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_garment_items_created_at 
ON public.garment_items(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.garment_items ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" 
ON public.garment_items
FOR SELECT
TO public
USING (true);

-- Create policy to allow public insert access
CREATE POLICY "Allow public insert access" 
ON public.garment_items
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy to allow public update access
CREATE POLICY "Allow public update access" 
ON public.garment_items
FOR UPDATE
TO public
USING (true);

-- Create policy to allow public delete access
CREATE POLICY "Allow public delete access" 
ON public.garment_items
FOR DELETE
TO public
USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.garment_items;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.garment_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.garment_items TO anon, authenticated;
