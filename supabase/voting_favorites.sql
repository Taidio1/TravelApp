-- ============================================================
-- Favorites + timed Voting rounds
-- Run this in the Supabase SQL editor (additive to seed.sql).
-- ============================================================

-- ---------- Favorites (private per-user) ----------
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  google_place_id TEXT,
  photo_url TEXT
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own favorites." ON favorites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own favorites." ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own favorites." ON favorites
  FOR DELETE USING (auth.uid() = user_id);

-- ---------- Voting rounds (one shared, timed round) ----------
CREATE TABLE IF NOT EXISTS voting_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  started_by UUID REFERENCES profiles(id),
  target_date DATE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  winner_place_id UUID REFERENCES places(id) ON DELETE SET NULL
);

ALTER TABLE voting_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voting rounds are viewable by everyone." ON voting_rounds
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can start a round." ON voting_rounds
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can finalize a round." ON voting_rounds
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ---------- Mark places as candidates of a round ----------
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES voting_rounds(id) ON DELETE SET NULL;

-- ---------- Let the round-starter (any auth user) save the winner ----------
CREATE POLICY "Authenticated users can add daily plans." ON daily_plans
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ---------- Realtime ----------
ALTER PUBLICATION supabase_realtime ADD TABLE favorites;
ALTER PUBLICATION supabase_realtime ADD TABLE voting_rounds;
