-- Additive setup for the existing production project. No public table access.
create table if not exists public.logo_download_totals (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  downloads bigint not null default 0 check (downloads >= 0)
);
create table if not exists public.logo_download_daily (
  day date not null default current_date,
  network_key text not null check (network_key ~ '^[a-f0-9]{64}$'),
  slug text not null,
  primary key (day, network_key, slug)
);
alter table public.logo_download_totals enable row level security;
alter table public.logo_download_daily enable row level security;
revoke all on public.logo_download_totals, public.logo_download_daily from anon, authenticated;
grant select, insert, update on public.logo_download_totals to service_role;
grant select, insert, delete on public.logo_download_daily to service_role;

create or replace function public.record_logo_downloads(requested_slugs text[], network_key text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if cardinality(requested_slugs) not between 1 and 50 or network_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid download event';
  end if;
  delete from public.logo_download_daily where day < current_date - 2;
  with accepted as (
    insert into public.logo_download_daily (day, network_key, slug)
    select current_date, record_logo_downloads.network_key, s
    from (select distinct unnest(requested_slugs) as s) selected
    on conflict do nothing returning slug
  )
  insert into public.logo_download_totals (slug, downloads)
  select slug, 1 from accepted
  on conflict (slug) do update set downloads = public.logo_download_totals.downloads + 1;
end;
$$;
revoke all on function public.record_logo_downloads(text[], text) from public, anon, authenticated;
grant execute on function public.record_logo_downloads(text[], text) to service_role;
