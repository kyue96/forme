-- Personal records table for tracking exercise PRs
create table if not exists personal_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  exercise_name text not null,
  e1rm numeric not null,
  weight numeric not null,
  reps integer not null,
  previous_e1rm numeric,
  achieved_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

alter table personal_records enable row level security;

create policy "Users can manage their own personal records"
  on personal_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast lookups per user per exercise
create index personal_records_user_exercise_idx on personal_records(user_id, exercise_name, achieved_at desc);
