-- Supabase owns auth.users and credential storage. Application sessions gate
-- every user-owned row even when a JWT is still cryptographically valid.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_activity timestamptz not null default now(),
  revoked boolean not null default false
);
alter table private.app_sessions enable row level security;

create function public.has_active_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.app_sessions s
    where s.session_id = nullif(auth.jwt()->>'session_id', '')::uuid
      and s.user_id = auth.uid() and not s.revoked
      and s.last_activity > now() - interval '30 minutes');
$$;
revoke all on function public.has_active_session() from public, anon;
grant execute on function public.has_active_session() to authenticated;

create function public.touch_session() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update private.app_sessions set last_activity = now()
    where session_id = nullif(auth.jwt()->>'session_id','')::uuid
      and user_id = auth.uid() and not revoked
      and last_activity > now() - interval '30 minutes';
  return found;
end;
$$;
revoke all on function public.touch_session() from public, anon;
grant execute on function public.touch_session() to authenticated;

-- Only the trusted backend may register a fresh, verified Auth session.
create function public.register_session(p_session_id uuid, p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into private.app_sessions(session_id,user_id) values(p_session_id,p_user_id)
    on conflict (session_id) do nothing;
$$;
revoke all on function public.register_session(uuid,uuid) from public, anon, authenticated;
grant execute on function public.register_session(uuid,uuid) to service_role;

create function public.revoke_session() returns void
language sql security definer set search_path = '' as $$
  update private.app_sessions set revoked=true
  where user_id=auth.uid() and session_id=nullif(auth.jwt()->>'session_id','')::uuid;
$$;
revoke all on function public.revoke_session() from public, anon;
grant execute on function public.revoke_session() to authenticated;

create table public.location_catalog (
  id text primary key,
  label text not null,
  latitude double precision not null check(latitude between 1.1 and 1.5),
  longitude double precision not null check(longitude between 103.5 and 104.2),
  source text not null check(source in ('fixture','onemap')),
  fetched_at timestamptz not null default now()
);
alter table public.location_catalog enable row level security;
create policy locations_read on public.location_catalog for select to authenticated
  using(public.has_active_session());
revoke all on public.location_catalog from anon, authenticated;
grant select on public.location_catalog to authenticated;
grant all on public.location_catalog to service_role;

create table public.preference_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  confirmed boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_owner on public.preference_profiles(user_id);
alter table public.preference_profiles enable row level security;
create policy profiles_owner on public.preference_profiles for all to authenticated
  using(user_id=auth.uid() and public.has_active_session())
  with check(user_id=auth.uid() and public.has_active_session());
revoke all on public.preference_profiles from anon, authenticated;
grant select, insert, update, delete on public.preference_profiles to authenticated;
grant all on public.preference_profiles to service_role;

create function private.validate_profile() returns trigger
language plpgsql set search_path = '' as $$
declare p jsonb := new.payload; d jsonb; l jsonb; x text; loc public.location_catalog%rowtype;
begin
  if current_user='authenticated' and not public.has_active_session() then raise exception 'SESSION_EXPIRED' using errcode='42501'; end if;
  -- Serializes competing inserts for an owner, including direct REST writes.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if tg_op='INSERT' then
    if (select count(*) from public.preference_profiles where user_id=new.user_id) >= 4 then
      raise exception 'PROFILE_LIMIT' using errcode='P0001';
    end if;
    new.confirmed:=false; new.revision:=1; new.created_at:=now();
  else
    if new.user_id<>old.user_id or new.id<>old.id then raise exception 'IMMUTABLE_OWNER'; end if;
    new.created_at:=old.created_at; new.revision:=old.revision+1;
    if new.payload is distinct from old.payload then new.confirmed:=false; end if;
  end if;
  new.updated_at:=now();
  if jsonb_typeof(p)<>'object' or not p ?& array['name','category','budgetMin','budgetMax','flatTypes','lookbackMonths','weights','destinations','lifestyles']
    or (select count(*) from jsonb_object_keys(p))<>9 then raise exception 'INVALID_PROFILE'; end if;
  if jsonb_typeof(p->'name')<>'string' or length(btrim(p->>'name')) not between 1 and 60
    or jsonb_typeof(p->'category')<>'string' or p->>'category' not in ('BTO','Resale HDB','Condominium','Private / landed') then raise exception 'INVALID_PROFILE'; end if;
  foreach x in array array['budgetMin','budgetMax','lookbackMonths'] loop
    if jsonb_typeof(p->x)<>'number' or (p->>x)::numeric <> trunc((p->>x)::numeric) then raise exception 'INVALID_NUMBER'; end if;
  end loop;
  if (p->>'budgetMin')::numeric not between 0 and 20000000
    or (p->>'budgetMax')::numeric not between 1 and 20000000
    or (p->>'budgetMin')::numeric>(p->>'budgetMax')::numeric
    or (p->>'lookbackMonths')::int not between 1 and 60 then raise exception 'INVALID_BUDGET'; end if;
  if jsonb_typeof(p->'flatTypes')<>'array' or jsonb_array_length(p->'flatTypes') not between 1 and 5
    or exists(select 1 from jsonb_array_elements_text(p->'flatTypes') v where v not in ('2-room','3-room','4-room','5-room','Executive'))
    or (select count(distinct v) from jsonb_array_elements_text(p->'flatTypes') v)<>jsonb_array_length(p->'flatTypes') then raise exception 'INVALID_FLAT_TYPES'; end if;
  if jsonb_typeof(p->'weights')<>'object' or not (p->'weights') ?& array['destination','lifestyle','affordability']
    or (select count(*) from jsonb_object_keys(p->'weights'))<>3 then raise exception 'INVALID_WEIGHTS'; end if;
  foreach x in array array['destination','lifestyle','affordability'] loop
    if jsonb_typeof(p->'weights'->x)<>'number' or (p->'weights'->>x)::numeric not between 0 and 100
      or (p->'weights'->>x)::numeric <> trunc((p->'weights'->>x)::numeric) then raise exception 'INVALID_WEIGHTS'; end if;
  end loop;
  if (p->'weights'->>'destination')::int+(p->'weights'->>'lifestyle')::int+(p->'weights'->>'affordability')::int<>100 then raise exception 'INVALID_WEIGHTS'; end if;
  if jsonb_typeof(p->'destinations')<>'array' or jsonb_array_length(p->'destinations') not between 1 and 4
    or jsonb_typeof(p->'lifestyles')<>'array' or jsonb_array_length(p->'lifestyles')>6 then raise exception 'INVALID_COUNTS'; end if;
  for d in select value from jsonb_array_elements(p->'destinations') loop
    if jsonb_typeof(d)<>'object' or not d ?& array['query','location','visits','mode'] or (select count(*) from jsonb_object_keys(d))<>4
      or jsonb_typeof(d->'query')<>'string' or length(btrim(d->>'query')) not between 1 and 250
      or jsonb_typeof(d->'visits')<>'number' or (d->>'visits')::numeric<>trunc((d->>'visits')::numeric)
      or (d->>'visits')::int not between 1 and 21 or jsonb_typeof(d->'mode')<>'string' or d->>'mode' not in ('public','private') then raise exception 'INVALID_DESTINATION'; end if;
    if d->'location' <> 'null'::jsonb then
      select * into loc from public.location_catalog where id=d->'location'->>'id';
      if not found or d->>'query'<>loc.label or d->'location' <> jsonb_build_object('id',loc.id,'label',loc.label,'latitude',loc.latitude,'longitude',loc.longitude,'source',loc.source)
        then raise exception 'UNVERIFIED_LOCATION'; end if;
    elsif new.confirmed then raise exception 'UNRESOLVED_LOCATION'; end if;
  end loop;
  for l in select value from jsonb_array_elements(p->'lifestyles') loop
    if jsonb_typeof(l)<>'object' or not l ?& array['category','priority','radius'] or (select count(*) from jsonb_object_keys(l))<>3
      or jsonb_typeof(l->'category')<>'string' or l->>'category' not in ('Badminton','Parks','Groceries','Hawker centres','Schools','Healthcare')
      or jsonb_typeof(l->'priority')<>'number' or (l->>'priority')::numeric<>trunc((l->>'priority')::numeric)
      or (l->>'priority')::int not between 1 and 5
      or jsonb_typeof(l->'radius')<>'number' or (l->>'radius')::numeric<>trunc((l->>'radius')::numeric)
      or (l->>'radius')::int not between 100 and 5000 then raise exception 'INVALID_LIFESTYLE'; end if;
  end loop;
  if (select count(distinct value->>'category') from jsonb_array_elements(p->'lifestyles'))<>jsonb_array_length(p->'lifestyles') then raise exception 'DUPLICATE_LIFESTYLE'; end if;
  if jsonb_array_length(p->'lifestyles')=0 and (p->'weights'->>'lifestyle')::int<>0 then raise exception 'INACTIVE_LIFESTYLE_WEIGHT'; end if;
  return new;
end;
$$;
create trigger profile_invariants before insert or update on public.preference_profiles
  for each row execute function private.validate_profile();

-- No public entrypoint may revive an expired session. Login is the only path.
revoke all on function private.validate_profile() from public, anon, authenticated;
