
-- Allow public read of enterprises marked as public (via profile slug lookup)
CREATE POLICY "Public read public enterprises"
ON public.enterprises
FOR SELECT
TO anon, authenticated
USING (is_public = true);
