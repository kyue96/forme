-- Add optional name column to meals for editable meal names
alter table meals add column if not exists name text;
