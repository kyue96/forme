-- =============================================
-- Social Feed System: Tables, RLS, Triggers
-- =============================================

-- 1. Add social columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS is_pro boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_currently_training boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS currently_training_since timestamptz,
  ADD COLUMN IF NOT EXISTS follower_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count integer DEFAULT 0;

-- Backfill display_name from auth.users metadata
UPDATE profiles p
SET display_name = COALESCE(
  (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p.id),
  (SELECT split_part(email, '@', 1) FROM auth.users WHERE id = p.id)
)
WHERE p.display_name IS NULL;

-- 2. follows
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read follows"
  ON follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can follow others"
  ON follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- 3. posts
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('workout_recap', 'photo', 'program_share', 'challenge_update')),
  caption text,
  workout_log_id uuid REFERENCES workout_logs(id) ON DELETE SET NULL,
  card_data jsonb,
  image_url text,
  program_data jsonb,
  visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
  like_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read public posts"
  ON posts FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR (visibility = 'followers' AND EXISTS (
      SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = posts.user_id
    ))
  );
CREATE POLICY "Users can create own posts"
  ON posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility, created_at DESC);

-- 4. post_reactions
CREATE TABLE IF NOT EXISTS post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions"
  ON post_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add reactions"
  ON post_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove own reactions"
  ON post_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reactions_post ON post_reactions(post_id);

-- 5. comments
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
  ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add comments"
  ON comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

-- 6. saved_programs
CREATE TABLE IF NOT EXISTS saved_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  program_data jsonb NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved programs"
  ON saved_programs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can save programs"
  ON saved_programs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own saved programs"
  ON saved_programs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 7. badges
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type text NOT NULL,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_type)
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own badges"
  ON badges FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Badges are inserted by service role (edge function), not client

-- 8. challenges
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('total_workouts', 'total_volume', 'streak', 'custom')),
  target_value integer,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public challenges"
  ON challenges FOR SELECT TO authenticated USING (is_public = true OR creator_id = auth.uid());
CREATE POLICY "Users can create challenges"
  ON challenges FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "Creators can update challenges"
  ON challenges FOR UPDATE TO authenticated USING (creator_id = auth.uid());
CREATE POLICY "Creators can delete challenges"
  ON challenges FOR DELETE TO authenticated USING (creator_id = auth.uid());

-- 9. challenge_participants
CREATE TABLE IF NOT EXISTS challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  progress integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read participants"
  ON challenge_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join challenges"
  ON challenge_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can leave challenges"
  ON challenge_participants FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own progress"
  ON challenge_participants FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- 10. subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  platform text,
  store_transaction_id text
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =============================================
-- Trigger functions for denormalized counters
-- =============================================

-- Follow counter triggers
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    UPDATE profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_follow_counts ON follows;
CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Reaction counter trigger
CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_like_count ON post_reactions;
CREATE TRIGGER trg_like_count
  AFTER INSERT OR DELETE ON post_reactions
  FOR EACH ROW EXECUTE FUNCTION update_like_count();

-- Comment counter trigger
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_count ON comments;
CREATE TRIGGER trg_comment_count
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- Storage bucket for post images (run via Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true);
