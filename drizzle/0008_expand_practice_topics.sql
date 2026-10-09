-- Additive catalog expansion. Existing topic IDs and practice sessions stay valid.
alter table public.practice_sessions drop constraint if exists practice_sessions_topic_id_check;
alter table public.practice_sessions drop constraint if exists practice_sessions_topic_check;
alter table public.practice_sessions add constraint practice_sessions_topic_check check (
  topic_id in (
    'arrays-hashing', 'two-pointers', 'sliding-window', 'stack', 'binary-search',
    'linked-lists', 'trees', 'backtracking', 'heaps-priority-queues', 'graphs-grids',
    'dynamic-programming', 'greedy', 'intervals', 'prefix-sum', 'tries'
  )
);
