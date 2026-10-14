-- Only the trusted backend can invalidate all sessions of a verified recovery owner.
create function public.revoke_user_sessions(p_user_id uuid) returns void
language sql security definer set search_path='' as $$
  update private.app_sessions set revoked=true where user_id=p_user_id;
$$;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
