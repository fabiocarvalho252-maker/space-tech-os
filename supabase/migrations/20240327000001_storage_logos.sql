-- Create logos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'logos', 'logos', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'logos'
);

-- Policy to allow public read access
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'logos');

-- Policy to allow authenticated users to upload logos
CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Policy to allow authenticated users to update their own logos
CREATE POLICY "Authenticated Update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'logos');

-- Policy to allow authenticated users to delete their own logos
CREATE POLICY "Authenticated Delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'logos');
