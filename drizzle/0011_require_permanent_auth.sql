-- Keep the existing owner policies, and add a restrictive layer so an
-- anonymous Auth JWT cannot access user-owned rows through the authenticated role.
-- Missing is_anonymous claims fail closed because NULL is not equal to 'false'.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'learn_conversations',
    'learn_messages',
    'courses',
    'course_materials',
    'material_pages',
    'material_chunks',
    'course_concepts',
    'course_concept_sources',
    'practice_sessions',
    'practice_messages'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select auth.jwt()->>''is_anonymous'') = ''false'') with check ((select auth.jwt()->>''is_anonymous'') = ''false'')',
      'Require permanent Auth for ' || table_name,
      table_name
    );
  end loop;
end
$$;

-- Keep direct anon-role execution denied as well. Anonymous Auth sessions use
-- the authenticated database role, so the restrictive table policies above are
-- the enforcement point for those JWTs through these SECURITY INVOKER RPCs.
revoke all on function public.search_course_material_chunks(uuid, text, extensions.vector, text, uuid, uuid, integer) from public, anon;
