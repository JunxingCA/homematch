create or replace function public.publish_private_snapshot(p_id text, p_payload jsonb)
returns text language plpgsql security invoker
set search_path = '' set statement_timeout = '60s' as $$
begin
  if p_id is null or length(p_id) > 200
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_payload->>'id' is distinct from p_id
     or p_payload->>'kind' is distinct from 'private' then
    raise exception 'INVALID_PRIVATE_SNAPSHOT';
  end if;
  if p_payload ? 'encoding' then
    if p_payload->>'encoding' is distinct from 'gzip-base64'
       or p_payload->>'storageVersion' is distinct from '1'
       or jsonb_typeof(p_payload->'bytes') is distinct from 'number'
       or (p_payload->>'bytes')::numeric not between 1 and 33554432
       or coalesce(p_payload->>'sha256','') !~ '^[a-f0-9]{64}$'
       or jsonb_typeof(p_payload->'data') is distinct from 'string'
       or length(p_payload->>'data') not between 1 and 33554432 then
      raise exception 'INVALID_PRIVATE_SNAPSHOT';
    end if;
  else
    if p_payload->>'version' is distinct from '1'
       or p_payload->'batches' is distinct from '[1,2,3,4]'::jsonb
       or jsonb_typeof(p_payload->'projects') is distinct from 'array' then
      raise exception 'INVALID_PRIVATE_SNAPSHOT';
    end if;
    if jsonb_array_length(p_payload->'projects') = 0 then
      raise exception 'INVALID_PRIVATE_SNAPSHOT';
    end if;
  end if;
  insert into public.market_price_snapshots(id, kind, payload)
    values(p_id, 'private', p_payload) on conflict(id) do nothing;
  if exists(select 1 from public.market_price_snapshots
    where id = p_id and payload is distinct from p_payload) then
    raise exception 'PRIVATE_SNAPSHOT_CONFLICT';
  end if;
  return p_id;
end;
$$;
revoke all on function public.publish_private_snapshot(text,jsonb) from public, anon, authenticated;
grant execute on function public.publish_private_snapshot(text,jsonb) to service_role;
