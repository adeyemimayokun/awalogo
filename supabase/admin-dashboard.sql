begin;
create table if not exists public.admin_plugin_snapshots (
 id uuid primary key default gen_random_uuid(), count bigint not null check(count>=0), source_url text not null,
 observed_at timestamptz not null, recorded_at timestamptz not null default now(), recorded_by text not null
);
create table if not exists public.asset_reports (
 submission_id uuid primary key, slug text not null, variation text not null, format text not null, reason text not null,
 note text not null default '', official_source text not null default '', status text not null default 'pending' check(status in ('pending','in-review','resolved','dismissed')),
 resolution_note text not null default '', updated_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.admin_report_audit (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.asset_reports(submission_id), status text not null, note text not null, actor text not null, created_at timestamptz not null default now()
);
create table if not exists public.product_event_daily (
 day date not null, event text not null, resource text not null default '', format text not null default '', detail text not null default '', count bigint not null default 0,
 primary key(day,event,resource,format,detail)
);
create table if not exists public.product_event_receipts (id uuid primary key, created_at timestamptz not null default now());
create or replace function public.record_product_event(event_id uuid,event_name text,resource_id text,event_format text,event_detail text)
returns void language plpgsql security invoker set search_path=public as $$
begin
 delete from public.product_event_receipts where created_at < now()-interval '2 days';
 insert into public.product_event_receipts(id) values(event_id) on conflict do nothing;
 if not found then return; end if;
 insert into public.product_event_daily(day,event,resource,format,detail,count) values((now() at time zone 'UTC')::date,event_name,resource_id,event_format,event_detail,1)
 on conflict(day,event,resource,format,detail) do update set count=product_event_daily.count+1;
end $$;
create or replace function public.triage_asset_report(report_id uuid,next_status text,resolution text,actor text)
returns void language plpgsql security invoker set search_path=public as $$
begin
 if next_status not in ('pending','in-review','resolved','dismissed') then raise exception 'Invalid status'; end if;
 if next_status in ('resolved','dismissed') and length(trim(resolution))<5 then raise exception 'Resolution note required'; end if;
 update public.asset_reports set status=next_status,resolution_note=resolution,updated_by=actor,updated_at=now() where submission_id=report_id;
 if not found then raise exception 'Report not found'; end if;
 insert into public.admin_report_audit(submission_id,status,note,actor) values(report_id,next_status,resolution,actor);
end $$;
alter table public.admin_plugin_snapshots enable row level security;
alter table public.asset_reports enable row level security;
alter table public.admin_report_audit enable row level security;
alter table public.product_event_daily enable row level security;
alter table public.product_event_receipts enable row level security;
revoke all on public.admin_plugin_snapshots,public.asset_reports,public.admin_report_audit,public.product_event_daily,public.product_event_receipts from public,anon,authenticated;
grant select,insert on public.admin_plugin_snapshots,public.admin_report_audit to service_role;
grant select,insert,update on public.asset_reports to service_role;
grant select,insert,update on public.product_event_daily to service_role;
grant select,insert,delete on public.product_event_receipts to service_role;
revoke all on function public.record_product_event(uuid,text,text,text,text),public.triage_asset_report(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_product_event(uuid,text,text,text,text),public.triage_asset_report(uuid,text,text,text) to service_role;
commit;
