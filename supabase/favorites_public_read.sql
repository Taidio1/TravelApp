-- Allow all authenticated users to read all favorites (community saved places view).
-- Run in Supabase SQL editor.
DROP POLICY IF EXISTS "Users can read their own favorites." ON favorites;
CREATE POLICY "Authenticated users can read all favorites." ON favorites
  FOR SELECT USING (auth.role() = 'authenticated');
