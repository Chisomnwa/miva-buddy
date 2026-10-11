create table if not exists public.remoteok_request_budgets (
  provider text not null check (provider = 'remoteok'),
  utc_date date not null,
  request_count integer not null check (request_count > 0),
  constraint remoteok_request_budgets_provider_day_unique unique (provider, utc_date)
);

alter table public.remoteok_request_budgets enable row level security;
revoke all on table public.remoteok_request_budgets from public;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = role_name) then
      execute format('revoke all on table public.remoteok_request_budgets from %I', role_name);
    end if;
  end loop;
end
$$;

create or replace function public.reserve_remoteok_request_budget(
  p_daily_limit integer,
  p_requested_at timestamptz default pg_catalog.clock_timestamp()
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  reserved_count integer;
  request_day date;
begin
  if p_daily_limit is null or p_daily_limit < 1 or p_requested_at is null then
    raise exception 'Invalid Remote OK budget reservation parameters';
  end if;

  request_day := (p_requested_at at time zone 'UTC')::date;

  insert into public.remoteok_request_budgets (provider, utc_date, request_count)
  values ('remoteok', request_day, 1)
  on conflict (provider, utc_date) do update
    set request_count = public.remoteok_request_budgets.request_count + 1
    where public.remoteok_request_budgets.request_count < p_daily_limit
  returning request_count into reserved_count;

  return found;
end
$$;

revoke all on function public.reserve_remoteok_request_budget(integer, timestamptz) from public;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = role_name) then
      execute format(
        'revoke all on function public.reserve_remoteok_request_budget(integer, timestamptz) from %I',
        role_name
      );
    end if;
  end loop;
end
$$;
