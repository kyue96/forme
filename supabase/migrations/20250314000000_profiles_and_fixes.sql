-- Profiles table for user settings
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  weight_unit text default 'lbs' check (weight_unit in ('lbs', 'kg')),
  rest_timer_enabled boolean default true,
  theme_mode text default 'dark' check (theme_mode in ('light', 'dark')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Add completed_at to workout_logs if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'workout_logs' and column_name = 'completed_at'
  ) then
    alter table public.workout_logs add column completed_at timestamptz default now();
  end if;
end$$;

-- Add created_at to meals if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'meals' and column_name = 'created_at'
  ) then
    alter table public.meals add column created_at timestamptz default now();
  end if;
end$$;
