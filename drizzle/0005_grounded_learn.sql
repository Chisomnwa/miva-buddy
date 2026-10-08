alter table public.learn_conversations
  add column course_id uuid,
  add column material_id uuid,
  add column concept_id uuid,
  add constraint learn_conversations_grounded_context_check
    check ((course_id is null and material_id is null and concept_id is null)
      or (course_id is not null and material_id is not null and concept_id is not null)),
  add constraint learn_conversations_course_owner_fk
    foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade,
  add constraint learn_conversations_material_owner_fk
    foreign key (material_id, course_id, user_id)
    references public.course_materials (id, course_id, user_id) on delete cascade,
  add constraint learn_conversations_concept_owner_fk
    foreign key (concept_id, material_id, user_id)
    references public.course_concepts (id, material_id, user_id) on delete cascade;

create index learn_conversations_course_updated_idx
  on public.learn_conversations (course_id, updated_at desc)
  where course_id is not null;

alter table public.learn_messages
  add column response_segments jsonb not null default '[]'::jsonb,
  add column grounding_status text not null default 'general'
    check (grounding_status in ('general', 'supporting_evidence_found', 'no_sufficient_support')),
  add constraint learn_messages_response_segments_array_check
    check (jsonb_typeof(response_segments) = 'array');

create or replace function public.search_course_material_chunks(
  p_course_id uuid,
  p_query_text text,
  p_query_embedding extensions.vector(768),
  p_material_id uuid default null,
  p_concept_id uuid default null,
  p_limit integer default 8
)
returns table (
  chunk_id uuid,
  course_id uuid,
  material_id uuid,
  content text,
  page_start integer,
  page_end integer,
  rank_score double precision,
  semantic_similarity double precision,
  lexical_match boolean,
  supports_current_concept boolean
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with query_terms as (
    select websearch_to_tsquery('english', coalesce(p_query_text, '')) as tsquery
  ), scoped as (
    select
      chunks.id,
      chunks.course_id,
      chunks.material_id,
      chunks.content,
      chunks.page_start,
      chunks.page_end,
      chunks.embedding,
      to_tsvector('english', chunks.content) as document,
      exists (
        select 1
        from public.course_concept_sources as concept_sources
        where concept_sources.user_id = (select auth.uid())
          and concept_sources.concept_id = p_concept_id
          and concept_sources.chunk_id = chunks.id
      ) as supports_current_concept
    from public.material_chunks as chunks
    join public.course_materials as materials
      on materials.id = chunks.material_id
      and materials.course_id = chunks.course_id
      and materials.user_id = chunks.user_id
      and materials.status = 'ready'
    where chunks.user_id = (select auth.uid())
      and chunks.course_id = p_course_id
      and (p_material_id is null or chunks.material_id = p_material_id)
      and chunks.embedding is not null
  ), semantic as (
    select
      scoped.id,
      row_number() over (order by scoped.embedding <=> p_query_embedding) as result_rank,
      1 - (scoped.embedding <=> p_query_embedding) as similarity
    from scoped
    order by scoped.embedding <=> p_query_embedding
    limit least(greatest(coalesce(p_limit, 8), 1), 12)
  ), lexical as (
    select
      scoped.id,
      row_number() over (order by ts_rank_cd(scoped.document, query_terms.tsquery) desc) as result_rank
    from scoped
    cross join query_terms
    where scoped.document @@ query_terms.tsquery
    order by ts_rank_cd(scoped.document, query_terms.tsquery) desc
    limit least(greatest(coalesce(p_limit, 8), 1), 12)
  ), combined as (
    select
      scoped.*,
      semantic.result_rank as semantic_rank,
      semantic.similarity,
      lexical.result_rank as lexical_rank
    from scoped
    left join semantic on semantic.id = scoped.id
    left join lexical on lexical.id = scoped.id
    where semantic.id is not null or lexical.id is not null
  )
  select
    combined.id as chunk_id,
    combined.course_id,
    combined.material_id,
    combined.content,
    combined.page_start,
    combined.page_end,
    (coalesce(1.0 / (60 + combined.semantic_rank), 0)
      + coalesce(1.0 / (60 + combined.lexical_rank), 0)
      + case when combined.supports_current_concept then 0.01 else 0 end)::double precision as rank_score,
    combined.similarity::double precision as semantic_similarity,
    (combined.lexical_rank is not null) as lexical_match,
    combined.supports_current_concept
  from combined
  order by rank_score desc, combined.page_start asc, combined.id asc
  limit least(greatest(coalesce(p_limit, 8), 1), 12);
$$;

revoke all on function public.search_course_material_chunks(uuid, text, extensions.vector, uuid, uuid, integer) from public, anon;
grant execute on function public.search_course_material_chunks(uuid, text, extensions.vector, uuid, uuid, integer) to authenticated;
