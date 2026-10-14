create table if not exists public.gemini_usage_daily (
  utc_date date not null,
  category text not null check (category in ('interactive', 'background', 'combined')),
  scope text not null check (scope in ('app', 'user')),
  scope_id text not null,
  usage_units integer not null default 0
    constraint gemini_usage_daily_units_check check (usage_units >= 0),
  primary key (utc_date, category, scope, scope_id),
  constraint gemini_usage_daily_scope_category_check check (
    (scope = 'user' and category in ('interactive', 'background') and scope_id <> 'all')
    or (scope = 'app' and category in ('interactive', 'background', 'combined') and scope_id = 'all')
  )
);

create table if not exists public.gemini_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category text not null check (category in ('interactive', 'background')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists gemini_usage_reservations_expiry_idx
  on public.gemini_usage_reservations (expires_at);

alter table public.gemini_usage_daily enable row level security;
alter table public.gemini_usage_reservations enable row level security;
revoke all on table public.gemini_usage_daily from public;
revoke all on table public.gemini_usage_reservations from public;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = role_name) then
      execute format('revoke all on table public.gemini_usage_daily from %I', role_name);
      execute format('revoke all on table public.gemini_usage_reservations from %I', role_name);
    end if;
  end loop;
end
$$;

create or replace function public.reserve_gemini_usage(
  p_user_id uuid,
  p_category text,
  p_usage_units integer,
  p_user_category_daily_limit integer,
  p_app_category_daily_limit integer,
  p_app_total_daily_limit integer,
  p_in_flight_limit integer,
  p_lease_seconds integer default 120
)
returns table (decision text, reservation_id uuid)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  request_day date := (pg_catalog.clock_timestamp() at time zone 'UTC')::date;
  app_category_units integer;
  user_category_units integer;
  app_total_units integer;
  active_count integer;
  new_reservation_id uuid;
begin
  if p_user_id is null or p_category is null or p_category not in ('interactive', 'background')
    or p_usage_units is null or p_usage_units < 1
    or p_user_category_daily_limit is null or p_user_category_daily_limit < 1
    or p_app_category_daily_limit is null or p_app_category_daily_limit < 1
    or p_app_total_daily_limit is null or p_app_total_daily_limit < 1
    or p_in_flight_limit is null or p_in_flight_limit < 1
    or p_lease_seconds is null or p_lease_seconds < 1 then
    raise exception 'Invalid Gemini usage reservation parameters';
  end if;

  -- Serialize admission globally so category counters, combined budget, and slots are atomic.
  perform pg_catalog.pg_advisory_xact_lock(184731, 90210);
  delete from public.gemini_usage_reservations where expires_at <= pg_catalog.clock_timestamp();
  delete from public.gemini_usage_daily where utc_date < request_day - 90;

  select coalesce(usage_units, 0) into app_category_units
    from public.gemini_usage_daily
    where utc_date = request_day and category = p_category and scope = 'app' and scope_id = 'all';
  select coalesce(usage_units, 0) into user_category_units
    from public.gemini_usage_daily
    where utc_date = request_day and category = p_category and scope = 'user' and scope_id = p_user_id::text;
  select coalesce(usage_units, 0) into app_total_units
    from public.gemini_usage_daily
    where utc_date = request_day and category = 'combined' and scope = 'app' and scope_id = 'all';
  select count(*)::integer into active_count from public.gemini_usage_reservations;

  if coalesce(user_category_units, 0) + p_usage_units > p_user_category_daily_limit then
    return query select 'user_daily_limit'::text, null::uuid;
    return;
  end if;
  if coalesce(app_category_units, 0) + p_usage_units > p_app_category_daily_limit then
    return query select 'app_category_daily_limit'::text, null::uuid;
    return;
  end if;
  if coalesce(app_total_units, 0) + p_usage_units > p_app_total_daily_limit then
    return query select 'app_daily_limit'::text, null::uuid;
    return;
  end if;
  if active_count >= p_in_flight_limit then
    return query select 'in_flight_limit'::text, null::uuid;
    return;
  end if;

  insert into public.gemini_usage_daily (utc_date, category, scope, scope_id, usage_units)
    values (request_day, p_category, 'app', 'all', p_usage_units)
    on conflict (utc_date, category, scope, scope_id) do update
      set usage_units = public.gemini_usage_daily.usage_units + excluded.usage_units;
  insert into public.gemini_usage_daily (utc_date, category, scope, scope_id, usage_units)
    values (request_day, p_category, 'user', p_user_id::text, p_usage_units)
    on conflict (utc_date, category, scope, scope_id) do update
      set usage_units = public.gemini_usage_daily.usage_units + excluded.usage_units;
  insert into public.gemini_usage_daily (utc_date, category, scope, scope_id, usage_units)
    values (request_day, 'combined', 'app', 'all', p_usage_units)
    on conflict (utc_date, category, scope, scope_id) do update
      set usage_units = public.gemini_usage_daily.usage_units + excluded.usage_units;

  insert into public.gemini_usage_reservations (user_id, category, expires_at)
    values (p_user_id, p_category, pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => p_lease_seconds))
    returning id into new_reservation_id;
  return query select 'reserved'::text, new_reservation_id;
end
$$;

create or replace function public.heartbeat_gemini_usage_reservation(
  p_reservation_id uuid,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_reservation_id is null or p_lease_seconds is null or p_lease_seconds < 1 then
    raise exception 'Invalid Gemini usage lease parameters';
  end if;
  update public.gemini_usage_reservations
    set expires_at = pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => p_lease_seconds)
    where id = p_reservation_id and expires_at > pg_catalog.clock_timestamp();
  return found;
end
$$;

create or replace function public.release_gemini_usage_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_reservation_id is null then return false; end if;
  delete from public.gemini_usage_reservations where id = p_reservation_id;
  return found;
end
$$;

revoke all on function public.reserve_gemini_usage(uuid, text, integer, integer, integer, integer, integer, integer) from public;
revoke all on function public.heartbeat_gemini_usage_reservation(uuid, integer) from public;
revoke all on function public.release_gemini_usage_reservation(uuid) from public;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = role_name) then
      execute format('revoke all on function public.reserve_gemini_usage(uuid, text, integer, integer, integer, integer, integer, integer) from %I', role_name);
      execute format('revoke all on function public.heartbeat_gemini_usage_reservation(uuid, integer) from %I', role_name);
      execute format('revoke all on function public.release_gemini_usage_reservation(uuid) from %I', role_name);
    end if;
  end loop;
end
$$;
