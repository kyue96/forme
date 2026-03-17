-- Custom exercises table
CREATE TABLE custom_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  muscle_group text NOT NULL,
  equipment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE custom_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom exercises"
  ON custom_exercises FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create custom exercises"
  ON custom_exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom exercises"
  ON custom_exercises FOR DELETE
  USING (auth.uid() = user_id);
