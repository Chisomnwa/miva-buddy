alter table public.material_pages
  drop constraint material_pages_content_check;

alter table public.material_pages
  add constraint material_pages_content_length_check
  check (char_length(content) <= 500000);
