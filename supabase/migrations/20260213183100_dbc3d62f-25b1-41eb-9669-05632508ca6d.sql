
-- Create storage bucket for seedance media uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('seedance-media', 'seedance-media', true);

-- Allow anyone to upload to seedance-media
CREATE POLICY "Anyone can upload seedance media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'seedance-media');

-- Allow anyone to read seedance media
CREATE POLICY "Anyone can read seedance media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'seedance-media');
