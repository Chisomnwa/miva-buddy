create table if not exists public.learn_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index if not exists learn_conversations_user_updated_idx
  on public.learn_conversations (user_id, updated_at desc);

create table if not exists public.learn_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  follow_up_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(follow_up_questions) = 'array'),
  created_at timestamptz not null default now(),
  constraint learn_messages_conversation_owner_fk
    foreign key (conversation_id, user_id)
    references public.learn_conversations (id, user_id)
    on delete cascade
);

create index if not exists learn_messages_conversation_created_idx
  on public.learn_messages (conversation_id, created_at, id);
create index if not exists learn_messages_user_created_idx
  on public.learn_messages (user_id, created_at desc);

alter table public.learn_conversations enable row level security;
alter table public.learn_messages enable row level security;

revoke all on public.learn_conversations from anon;
revoke all on public.learn_messages from anon;
grant select, insert, update on public.learn_conversations to authenticated;
grant select, insert on public.learn_messages to authenticated;

create policy "Students can read their own Learn conversations"
  on public.learn_conversations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Students can create their own Learn conversations"
  on public.learn_conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Students can update their own Learn conversations"
  on public.learn_conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Students can read their own Learn messages"
  on public.learn_messages for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Students can create their own Learn messages"
  on public.learn_messages for insert to authenticated
  with check ((select auth.uid()) = user_id);
