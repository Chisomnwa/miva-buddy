grant insert on public.material_pages to authenticated;

create policy "Students can add their own queued pasted notes"
  on public.material_pages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.course_materials
      where id = material_id
        and course_id = material_pages.course_id
        and user_id = material_pages.user_id
        and kind = 'notes'
        and status = 'queued'
    )
  );
