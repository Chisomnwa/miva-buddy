alter table public.course_materials
  add column manual_retry_count integer not null default 0,
  add constraint course_materials_manual_retry_count_check check (manual_retry_count >= 0);

create table public.course_material_admissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  utc_date date not null,
  upload_bytes bigint not null constraint course_material_admissions_bytes_check check (upload_bytes >= 0),
  state text not null constraint course_material_admissions_state_check check (state in ('pending', 'admitted')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint course_material_admissions_lease_check check (
    (state = 'pending' and expires_at is not null) or (state = 'admitted' and expires_at is null)
  )
);
create index course_material_admissions_user_day_idx
  on public.course_material_admissions (user_id, utc_date);

alter table public.course_material_admissions enable row level security;
revoke all on public.course_material_admissions from public;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = role_name) then
      execute format('revoke all on table public.course_material_admissions from %I', role_name);
    end if;
  end loop;
end
$$;

create or replace function public.reserve_course_material_admission(
  p_user_id uuid,
  p_upload_bytes bigint,
  p_daily_count_limit integer,
  p_daily_bytes_limit bigint,
  p_lease_seconds integer default 1800
)
returns table (decision text, reservation_id uuid)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  request_day date := (pg_catalog.clock_timestamp() at time zone 'UTC')::date;
  admitted_count integer;
  admitted_bytes bigint;
  new_reservation_id uuid;
begin
  if p_user_id is null or p_upload_bytes is null or p_upload_bytes < 0
    or p_daily_count_limit is null or p_daily_count_limit < 1
    or p_daily_bytes_limit is null or p_daily_bytes_limit < 1
    or p_lease_seconds is null or p_lease_seconds < 1 then
    raise exception 'Invalid course material admission parameters';
  end if;

  -- Serialize quota checks and pending reservations across concurrent app instances.
  perform pg_catalog.pg_advisory_xact_lock(184731, 90211);
  delete from public.course_material_admissions
    where state = 'pending' and expires_at <= pg_catalog.clock_timestamp();
  delete from public.course_material_admissions where utc_date < request_day - 90;

  select count(*)::integer, coalesce(sum(upload_bytes), 0)::bigint
    into admitted_count, admitted_bytes
    from public.course_material_admissions
    where user_id = p_user_id and utc_date = request_day;

  if admitted_count + 1 > p_daily_count_limit then
    return query select 'daily_count_limit'::text, null::uuid;
    return;
  end if;
  if admitted_bytes + p_upload_bytes > p_daily_bytes_limit then
    return query select 'daily_bytes_limit'::text, null::uuid;
    return;
  end if;

  insert into public.course_material_admissions (user_id, utc_date, upload_bytes, state, expires_at)
    values (p_user_id, request_day, p_upload_bytes, 'pending',
      pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => p_lease_seconds))
    returning id into new_reservation_id;
  return query select 'reserved'::text, new_reservation_id;
end
$$;

create or replace function public.finalize_course_material_admission(p_reservation_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_reservation_id is null or p_user_id is null then return false; end if;
  update public.course_material_admissions
    set state = 'admitted', expires_at = null
    where id = p_reservation_id and user_id = p_user_id and state = 'pending'
      and expires_at > pg_catalog.clock_timestamp();
  return found;
end
$$;

create or replace function public.release_course_material_admission(p_reservation_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_reservation_id is null or p_user_id is null then return false; end if;
  delete from public.course_material_admissions
    where id = p_reservation_id and user_id = p_user_id and state = 'pending';
  return found;
end
$$;

revoke all on function public.reserve_course_material_admission(uuid, bigint, integer, bigint, integer) from public;
revoke all on function public.finalize_course_material_admission(uuid, uuid) from public;
revoke all on function public.release_course_material_admission(uuid, uuid) from public;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = role_name) then
      execute format('revoke all on function public.reserve_course_material_admission(uuid, bigint, integer, bigint, integer) from %I', role_name);
      execute format('revoke all on function public.finalize_course_material_admission(uuid, uuid) from %I', role_name);
      execute format('revoke all on function public.release_course_material_admission(uuid, uuid) from %I', role_name);
    end if;
  end loop;
end
$$;
