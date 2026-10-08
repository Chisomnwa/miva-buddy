create extension if not exists vector with schema extensions;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  course_code text check (course_code is null or char_length(course_code) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index courses_user_updated_idx on public.courses (user_id, updated_at desc);

create table public.course_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  kind text not null check (kind in ('pdf', 'notes')),
  storage_path text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed')),
  failure_code text,
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, course_id, user_id),
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade,
  check ((kind = 'pdf' and storage_path is not null) or (kind = 'notes' and storage_path is null))
);
create index course_materials_course_created_idx on public.course_materials (course_id, created_at desc);

create table public.material_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null,
  material_id uuid not null,
  page_number integer not null check (page_number > 0),
  section_label text,
  content text not null check (char_length(content) <= 100000),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (material_id, page_number),
  foreign key (material_id, course_id, user_id)
    references public.course_materials (id, course_id, user_id) on delete cascade
);
create index material_pages_material_page_idx on public.material_pages (material_id, page_number);

create table public.material_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null,
  material_id uuid not null,
  ordinal integer not null check (ordinal >= 0),
  page_start integer not null check (page_start > 0),
  page_end integer not null check (page_end >= page_start),
  content text not null check (char_length(content) between 1 and 12000),
  embedding extensions.vector(768),
  embedding_model text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, material_id, user_id),
  unique (material_id, ordinal),
  foreign key (material_id, course_id, user_id)
    references public.course_materials (id, course_id, user_id) on delete cascade,
  check ((embedding is null) = (embedding_model is null))
);
create index material_chunks_material_ordinal_idx on public.material_chunks (material_id, ordinal);
create index material_chunks_content_fts_idx
  on public.material_chunks using gin (to_tsvector('english', content));
create index material_chunks_embedding_hnsw_idx
  on public.material_chunks using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create table public.course_concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null,
  material_id uuid not null,
  title text not null check (char_length(title) between 2 and 120),
  description text not null check (char_length(description) between 1 and 1000),
  ordinal integer not null check (ordinal >= 0),
  extraction_version text not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, material_id, user_id),
  unique (material_id, ordinal),
  foreign key (material_id, course_id, user_id)
    references public.course_materials (id, course_id, user_id) on delete cascade
);
create index course_concepts_material_ordinal_idx on public.course_concepts (material_id, ordinal);

create table public.course_concept_sources (
  user_id uuid not null references auth.users (id) on delete cascade,
  material_id uuid not null,
  concept_id uuid not null,
  chunk_id uuid not null,
  foreign key (concept_id, material_id, user_id)
    references public.course_concepts (id, material_id, user_id) on delete cascade,
  foreign key (chunk_id, material_id, user_id)
    references public.material_chunks (id, material_id, user_id) on delete cascade,
  unique (concept_id, chunk_id)
);
create index course_concept_sources_chunk_idx on public.course_concept_sources (chunk_id);

alter table public.courses enable row level security;
alter table public.course_materials enable row level security;
alter table public.material_pages enable row level security;
alter table public.material_chunks enable row level security;
alter table public.course_concepts enable row level security;
alter table public.course_concept_sources enable row level security;

revoke all on public.courses, public.course_materials, public.material_pages,
  public.material_chunks, public.course_concepts, public.course_concept_sources from anon;
grant select, insert, update, delete on public.courses to authenticated;
grant select, insert on public.course_materials to authenticated;
grant select on public.material_pages, public.material_chunks,
  public.course_concepts, public.course_concept_sources to authenticated;

create policy "Students can manage their own courses"
  on public.courses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Students can read their own course materials"
  on public.course_materials for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Students can queue their own course materials"
  on public.course_materials for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'queued' and processing_attempts = 0);

create policy "Students can read their own material pages"
  on public.material_pages for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Students can read their own material chunks"
  on public.material_chunks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Students can read their own course concepts"
  on public.course_concepts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Students can read their own concept sources"
  on public.course_concept_sources for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Students can read their own course material objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Students can upload their own course material objects"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-materials' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Students can delete their own course material objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = (select auth.uid()::text));
