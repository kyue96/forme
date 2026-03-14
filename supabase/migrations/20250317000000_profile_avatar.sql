-- Add avatar_url to profiles table
alter table profiles add column if not exists avatar_url text;
