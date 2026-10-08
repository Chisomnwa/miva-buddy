create table public.practice_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  attempt text check (attempt is null or char_length(attempt) <= 6000),
  mode text not null check (mode in ('hands_off', 'coach', 'tutor')),
  request_type text check (request_type in ('stuck', 'code_error', 'failed_test', 'explain_approach', 'walkthrough', 'dry_run', 'full_answer', 'other')),
  response_payload jsonb,
  created_at timestamptz not null default now(),
  constraint practice_messages_session_owner_fk foreign key (session_id, user_id)
    references public.practice_sessions(id, user_id) on delete cascade,
  constraint practice_messages_assistant_payload_check check (
    (role = 'assistant' and response_payload is not null and jsonb_typeof(response_payload) = 'object')
    or (role = 'user' and response_payload is null)
  )
);

create index practice_messages_session_created_idx on public.practice_messages(session_id, created_at, id);
create index practice_messages_user_created_idx on public.practice_messages(user_id, created_at desc) where role = 'user';

alter table public.practice_messages enable row level security;
create policy "Users can read their practice messages"
  on public.practice_messages for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their practice messages"
  on public.practice_messages for insert to authenticated with check ((select auth.uid()) = user_id);
grant select, insert on public.practice_messages to authenticated;
