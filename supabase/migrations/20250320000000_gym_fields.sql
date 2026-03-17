-- Add gym fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gym_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gym_place_id text;
