create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  programme text not null check (char_length(programme) between 2 and 100),
  level text not null check (char_length(level) between 2 and 40),
  career_interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

create policy "Students can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Students can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Students can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Students can delete their own profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = user_id);
