-- Add calories_burned column to activities table
alter table activities add column if not exists calories_burned integer;
