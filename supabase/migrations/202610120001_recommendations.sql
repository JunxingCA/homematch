create table public.research_snapshots (
  id text primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
alter table public.research_snapshots enable row level security;
revoke all on public.research_snapshots from anon, authenticated;
grant select, insert on public.research_snapshots to service_role;

create table public.discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.preference_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
create index discoveries_owner on public.discoveries(user_id,created_at desc);
alter table public.discoveries enable row level security;
revoke all on public.discoveries from anon, authenticated;
grant select on public.discoveries to authenticated;
grant select, insert on public.discoveries to service_role;
create policy discoveries_read on public.discoveries for select to authenticated
  using (user_id=auth.uid() and public.has_active_session());

-- Public research is imported by the backend. Only the backend can publish
-- immutable discoveries; clients cannot submit their own scores or evidence.
