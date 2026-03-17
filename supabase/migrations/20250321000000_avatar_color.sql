-- Add avatar_color to profiles table for persistent avatar color selection
alter table profiles add column if not exists avatar_color text;
