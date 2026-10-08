create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id integer not null check (problem_id > 0),
  problem_slug text not null check (problem_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  topic_id text not null check (topic_id in ('arrays-hashing', 'two-pointers', 'stack', 'binary-search', 'linked-lists', 'trees', 'graphs-grids')),
  source_concept_id uuid,
  mode text not null default 'coach' check (mode in ('hands_off', 'coach', 'tutor')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint practice_sessions_completion_check check ((status = 'completed') = (completed_at is not null)),
  constraint practice_sessions_concept_owner_fk foreign key (source_concept_id, user_id)
    references public.course_concepts(id, user_id),
  constraint practice_sessions_id_user_unique unique (id, user_id)
);

create index practice_sessions_user_updated_idx on public.practice_sessions(user_id, updated_at desc);
create index practice_sessions_user_status_updated_idx on public.practice_sessions(user_id, status, updated_at desc);

alter table public.practice_sessions enable row level security;

create policy "Users can read their practice sessions"
  on public.practice_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their practice sessions"
  on public.practice_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their practice sessions"
  on public.practice_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their practice sessions"
  on public.practice_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

create unique index practice_sessions_one_active_problem_idx
  on public.practice_sessions(user_id, problem_id) where status = 'in_progress';

grant select, insert, update, delete on public.practice_sessions to authenticated;
