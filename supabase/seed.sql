-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create places table
CREATE TABLE places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('food', 'sightseeing', 'activity')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  google_place_id TEXT,
  photo_url TEXT,
  rating DOUBLE PRECISION,
  user_ratings_total INTEGER,
  ai_suggested BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected'))
);

-- Create votes table
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type SMALLINT DEFAULT 1,
  UNIQUE(place_id, user_id)
);

-- Create daily_plans table
CREATE TABLE daily_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  time_slot TIME,
  "order" INTEGER,
  assigned_by UUID REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Places Policies
CREATE POLICY "Places are viewable by everyone." ON places FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert places." ON places FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins or owners can update places." ON places FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR created_by = auth.uid()
);

-- Votes Policies
CREATE POLICY "Votes are viewable by everyone." ON votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote." ON votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can delete their own vote." ON votes FOR DELETE USING (auth.uid() = user_id);

-- Daily Plans Policies
CREATE POLICY "Daily plans are viewable by everyone." ON daily_plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage daily plans." ON daily_plans FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE places;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_plans;
