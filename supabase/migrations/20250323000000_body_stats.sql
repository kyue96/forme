-- Body stats tracking table for weight/body fat logging
create table if not exists body_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  weight_kg numeric,
  body_fat_pct numeric,
  notes text,
  created_at timestamptz default now() not null
);

alter table body_stats enable row level security;

create policy "Users can manage their own body stats"
  on body_stats for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Prevent duplicate entries per user per day
create unique index body_stats_user_date_idx on body_stats(user_id, date);
