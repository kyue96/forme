-- Activities table for logging walks, runs, etc.
create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  date date not null,
  type text not null,
  duration_minutes integer,
  notes text,
  created_at timestamp with time zone default now()
);

-- Add fats column to meals
alter table meals add column if not exists fats integer;

-- RLS for activities
alter table activities enable row level security;

create policy "Users can view own activities"
  on activities for select
  using (auth.uid() = user_id);

create policy "Users can insert own activities"
  on activities for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own activities"
  on activities for delete
  using (auth.uid() = user_id);
