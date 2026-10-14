-- Hide recent-history entries without deleting immutable bookmark evidence.
create table public.discovery_history_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cleared_before timestamptz not null default clock_timestamp()
);
alter table public.discovery_history_settings enable row level security;
revoke all on public.discovery_history_settings from public, anon, authenticated;
grant select, insert, update on public.discovery_history_settings to authenticated;
grant all on public.discovery_history_settings to service_role;
create policy history_owner_read on public.discovery_history_settings for select to authenticated
using (user_id = (select auth.uid()) and (select public.has_active_session()));
create policy history_owner_insert on public.discovery_history_settings for insert to authenticated
with check (user_id = (select auth.uid()) and (select public.has_active_session()));
create policy history_owner_update on public.discovery_history_settings for update to authenticated
using (user_id = (select auth.uid()) and (select public.has_active_session()))
with check (user_id = (select auth.uid()) and (select public.has_active_session()));

create function public.clear_discovery_history() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_active_session() then
    raise exception 'SIGN_IN_REQUIRED' using errcode = '42501';
  end if;
  insert into public.discovery_history_settings(user_id, cleared_before)
  values (auth.uid(), clock_timestamp())
  on conflict (user_id) do update
  set cleared_before = greatest(discovery_history_settings.cleared_before, excluded.cleared_before);
end;
$$;

create function public.recent_discoveries()
returns table(id uuid, created_at timestamptz, profile_name text)
language sql stable security invoker set search_path = '' as $$
  select d.id, d.created_at, d.payload->'preference'->>'name'
  from public.discoveries d
  where d.user_id = (select auth.uid())
    and (select public.has_active_session())
    and d.created_at > coalesce(
      (select h.cleared_before from public.discovery_history_settings h
       where h.user_id = (select auth.uid())), '-infinity'::timestamptz)
  order by d.created_at desc, d.id desc limit 10;
$$;
revoke all on function public.clear_discovery_history(), public.recent_discoveries() from public, anon, authenticated;
grant execute on function public.clear_discovery_history(), public.recent_discoveries() to authenticated;
