create table public.saved_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discovery_id uuid not null references public.discoveries(id) on delete cascade,
  area_id text not null check (length(area_id) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (user_id, area_id)
);
create index saved_areas_owner on public.saved_areas(user_id, created_at desc);
alter table public.saved_areas enable row level security;
revoke all on public.saved_areas from anon, authenticated;
grant select, insert, delete on public.saved_areas to authenticated;
grant select on public.saved_areas to service_role;
create policy saved_areas_read on public.saved_areas for select to authenticated
  using (user_id = auth.uid() and public.has_active_session());
create policy saved_areas_remove on public.saved_areas for delete to authenticated
  using (user_id = auth.uid() and public.has_active_session());
create policy saved_areas_add on public.saved_areas for insert to authenticated
  with check (
    user_id = auth.uid() and public.has_active_session() and exists (
      select 1 from public.discoveries d
      where d.id = discovery_id and d.user_id = auth.uid()
      and d.payload->'results' @> jsonb_build_array(
        jsonb_build_object('area', jsonb_build_object('id', area_id))
      )
    )
  );

-- Only bookmarks are mutable. Evidence stays in the owner's immutable discovery.
-- A town can be saved once per account; repeated saves retain its original search.
