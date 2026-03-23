-- Create public storage bucket for post images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post-images', 'post-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
DO $$ BEGIN
  CREATE POLICY "Users can upload post images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow anyone to view post images (public bucket)
DO $$ BEGIN
  CREATE POLICY "Public can view post images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'post-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow users to delete their own images
DO $$ BEGIN
  CREATE POLICY "Users can delete own post images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
