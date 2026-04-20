/*
  # Storage Bucket Configuration

  ## Overview
  Sets up Supabase Storage bucket for clothing images with appropriate access policies.

  ## Buckets
  - `clothing-images` - Stores all uploaded clothing item photos

  ## Security
  - Authenticated users can upload to their own folder (user_id/)
  - Users can only read their own images
  - Public access disabled for privacy
  - File size limit: 5MB
  - Allowed types: image/jpeg, image/png, image/webp
*/

-- Create storage bucket for clothing images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clothing-images',
  'clothing-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload own clothing images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'clothing-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to read their own images
CREATE POLICY "Users can view own clothing images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'clothing-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own images
CREATE POLICY "Users can delete own clothing images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'clothing-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );