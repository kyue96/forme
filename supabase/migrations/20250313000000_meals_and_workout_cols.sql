-- Meals table for post-workout macro logging
create table if not exists meals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  calories integer,
  protein integer,
  carbs integer,
  created_at timestamptz default now() not null
);

alter table meals enable row level security;

create policy "Users can manage their own meals"
  on meals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add columns to workout_logs for location and duration tracking
alter table workout_logs add column if not exists location text;
alter table workout_logs add column if not exists duration_minutes integer;
alter table workout_logs add column if not exists suggested_weight numeric;
