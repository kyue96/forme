-- Saved routines for quick workouts
create table if not exists saved_routines (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  exercises jsonb not null,
  last_used_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

alter table saved_routines enable row level security;

create policy "Users can manage their own routines"
  on saved_routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
