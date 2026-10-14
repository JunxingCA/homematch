create table public.market_price_snapshots (
  id text primary key,
  kind text not null check (kind in ('private')),
  created_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload ? 'kind' and payload ? 'id' and payload->>'kind' = kind and payload->>'id' = id)
);
create index market_snapshot_latest on public.market_price_snapshots(kind, created_at desc);
alter table public.market_price_snapshots enable row level security;
revoke all on public.market_price_snapshots from public, anon, authenticated;
grant select, insert on public.market_price_snapshots to service_role;
