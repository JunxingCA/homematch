create table private.operation_usage (
  operation text not null,
  subject text not null,
  started_at timestamptz not null default now(),
  last_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (operation, subject)
);
create index operation_usage_retention on private.operation_usage(operation, started_at);

create table private.operation_leases (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  subject text not null,
  expires_at timestamptz not null
);
create index operation_leases_capacity on private.operation_leases(operation, expires_at);
create index operation_leases_owner on private.operation_leases(operation, subject, expires_at);
alter table private.operation_usage enable row level security;
alter table private.operation_leases enable row level security;
revoke all on private.operation_usage, private.operation_leases from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.operation_usage, private.operation_leases to service_role;

-- A short admission transaction coordinates all app instances. No provider work occurs under this lock.
create function public.acquire_operation(p_operation text, p_subject text) returns jsonb
language plpgsql security invoker set search_path = '' set lock_timeout = '2s' as $$
declare
  t timestamptz;
  duration integer;
  owner_limit integer;
  global_limit integer;
  cooldown integer;
  capacity integer;
  owner_capacity integer := 1;
  lease_seconds integer;
  owner_row private.operation_usage%rowtype;
  global_row private.operation_usage%rowtype;
  wait_seconds integer;
  lease_id uuid;
begin
  if p_subject is null or p_subject !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_LIMIT_SUBJECT';
  end if;
  case p_operation
    when 'ai' then duration := 3600; owner_limit := 10; global_limit := 120; cooldown := 10; capacity := 6; lease_seconds := 120;
    when 'discovery' then duration := 3600; owner_limit := 12; global_limit := 100; cooldown := 15; capacity := 10; lease_seconds := 300;
    when 'journeys' then duration := 3600; owner_limit := 60; global_limit := 300; cooldown := 0; capacity := 10; lease_seconds := 120;
    when 'locations' then duration := 60; owner_limit := 60; global_limit := 600; cooldown := 0; capacity := 30; owner_capacity := 5; lease_seconds := 45;
    else raise exception 'INVALID_LIMIT_OPERATION';
  end case;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('homematch:limits:' || p_operation, 0));
  t := clock_timestamp();
  delete from private.operation_leases where operation = p_operation and expires_at <= t;
  delete from private.operation_usage where operation = p_operation and started_at < t - interval '7 days';
  insert into private.operation_usage(operation, subject, started_at)
    values(p_operation, p_subject, t), (p_operation, 'global', t) on conflict do nothing;
  update private.operation_usage set started_at = t, attempts = 0
    where operation = p_operation and subject in (p_subject, 'global')
      and started_at + make_interval(secs => duration) <= t;
  select * into owner_row from private.operation_usage where operation = p_operation and subject = p_subject;
  select * into global_row from private.operation_usage where operation = p_operation and subject = 'global';
  if owner_row.attempts >= owner_limit or global_row.attempts >= global_limit then
    wait_seconds := greatest(
      case when owner_row.attempts >= owner_limit then ceil(extract(epoch from owner_row.started_at + make_interval(secs => duration) - t))::integer else 0 end,
      case when global_row.attempts >= global_limit then ceil(extract(epoch from global_row.started_at + make_interval(secs => duration) - t))::integer else 0 end
    );
  elsif owner_row.last_at + make_interval(secs => cooldown) > t then
    wait_seconds := ceil(extract(epoch from owner_row.last_at + make_interval(secs => cooldown) - t))::integer;
  elsif (select count(*) from private.operation_leases where operation = p_operation and subject = p_subject) >= owner_capacity then
    select ceil(extract(epoch from min(expires_at) - t))::integer into wait_seconds from private.operation_leases where operation = p_operation and subject = p_subject;
  elsif (select count(*) from private.operation_leases where operation = p_operation) >= capacity then
    select ceil(extract(epoch from min(expires_at) - t))::integer into wait_seconds from private.operation_leases where operation = p_operation;
  end if;
  if wait_seconds is not null then
    return jsonb_build_object('allowed', false, 'retryAfter', greatest(1, wait_seconds));
  end if;
  update private.operation_usage set attempts = attempts + 1, last_at = t
    where operation = p_operation and subject in (p_subject, 'global');
  insert into private.operation_leases(operation, subject, expires_at)
    values(p_operation, p_subject, t + make_interval(secs => lease_seconds)) returning id into lease_id;
  return jsonb_build_object('allowed', true, 'leaseId', lease_id);
end;
$$;

create function public.release_operation(p_operation text, p_subject text, p_lease uuid) returns void
language sql security invoker set search_path = '' as $$
  delete from private.operation_leases where id = p_lease and operation = p_operation and subject = p_subject;
$$;
revoke all on function public.acquire_operation(text, text), public.release_operation(text, text, uuid) from public, anon, authenticated;
grant execute on function public.acquire_operation(text, text), public.release_operation(text, text, uuid) to service_role;
