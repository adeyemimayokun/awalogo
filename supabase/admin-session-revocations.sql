begin;
create table if not exists public.admin_session_revocations (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'), expires_at timestamptz not null
);
create index if not exists admin_session_revocations_expiry on public.admin_session_revocations(expires_at);
alter table public.admin_session_revocations enable row level security;
revoke all on public.admin_session_revocations from public,anon,authenticated;
grant select,insert,delete on public.admin_session_revocations to service_role;
create or replace function public.revoke_admin_session(session_hash text,session_expiry timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
 delete from public.admin_session_revocations where expires_at<=now();
 insert into public.admin_session_revocations(token_hash,expires_at) values(session_hash,session_expiry) on conflict(token_hash) do nothing;
end $$;
revoke all on function public.revoke_admin_session(text,timestamptz) from public,anon,authenticated;
grant execute on function public.revoke_admin_session(text,timestamptz) to service_role;
commit;
