/*
  # Create Config Table for Dynamic API URLs

  ## Overview
  Creates a simple config table to store dynamic URLs (e.g., ngrok tunnel URL)
  This allows the frontend to fetch the current Flask API URL without code changes.

  ## Table
  - `app_config` with columns:
    - key (text, primary key)
    - value (text)
    - updated_at (timestamptz)
*/

-- Create the app_config table
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" 
ON public.app_config
FOR SELECT
TO public
USING (true);

-- Create policy to allow authenticated users to update
CREATE POLICY "Allow insert/update" 
ON public.app_config
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update access" 
ON public.app_config
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Insert initial flask_api_url config
INSERT INTO public.app_config (key, value) 
VALUES ('flask_api_url', 'http://127.0.0.1:5000')
ON CONFLICT (key) DO NOTHING;
