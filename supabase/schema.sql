create table public.brands (
 id uuid primary key default gen_random_uuid(),
 slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check (length(name) between 2 and 120),
 website text not null check (website ~ '^https://'),
 country_code text not null default 'NG' check (country_code ~ '^[A-Z]{2}$'),
 industries text[] not null default '{}',
 institution_slug text,
 suspended_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.brand_members (
 brand_id uuid not null references public.brands(id),
 user_id uuid not null references auth.users(id),
 role text not null default 'owner' check (role in ('owner','editor')),
 approved_at timestamptz,
 revoked_at timestamptz,
 primary key (brand_id,user_id)
);
create table public.brand_claims (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id),
 user_id uuid not null references auth.users(id),
 company_email text not null,
 evidence text not null default '' check (length(evidence) <= 10000),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index brand_claims_one_pending on public.brand_claims(brand_id,user_id) where status='pending';
create table public.asset_requests (
 submission_id uuid primary key,
 brand_name text not null,
 website text not null,
 category text not null,
 contact_email text not null,
 asset_url text,
 notify_when_available boolean not null default false,
 status text not null default 'pending' check (status in ('pending','in-review','needs-info','approved','completed','rejected')),
 tracking_token_hash text unique not null,
 github_issue_number integer,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.brand_drafts (
 brand_id uuid primary key references public.brands(id),
 payload jsonb not null default '{}',
 revision integer not null default 1,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
create table public.brand_revisions (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id),
 payload jsonb not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.publication_jobs (
 id uuid primary key default gen_random_uuid(),
 revision_id uuid unique not null references public.brand_revisions(id),
 status text not null default 'queued' check (status in ('queued','syncing','deploying','live','failed')),
 attempts integer not null default 0,
 repository_commit text,
 deployment_url text,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.brand_audit (
 id bigint generated always as identity primary key,
 brand_id uuid references public.brands(id),
 actor_id uuid references auth.users(id),
 action text not null,
 revision_id uuid references public.brand_revisions(id),
 created_at timestamptz not null default now()
);
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.brand_claims enable row level security;
alter table public.asset_requests enable row level security;
alter table public.brand_drafts enable row level security;
alter table public.brand_revisions enable row level security;
alter table public.publication_jobs enable row level security;
alter table public.brand_audit enable row level security;
revoke all on public.brands,public.brand_members,public.brand_claims,public.asset_requests,public.brand_drafts,public.brand_revisions,public.publication_jobs,public.brand_audit from anon,authenticated;
grant all on public.brands,public.brand_members,public.brand_claims,public.asset_requests,public.brand_drafts,public.brand_revisions,public.publication_jobs,public.brand_audit to service_role;
grant usage,select on sequence public.brand_audit_id_seq to service_role;
grant select on public.brands,public.brand_members,public.brand_claims,public.brand_drafts,public.brand_revisions,public.publication_jobs,public.brand_audit to authenticated;
grant insert,update on public.brand_drafts to authenticated;
create policy own_memberships on public.brand_members for select to authenticated using (user_id=(select auth.uid()));
create policy own_claims on public.brand_claims for select to authenticated using (user_id=(select auth.uid()));
create policy assigned_brands on public.brands for select to authenticated using (
 exists(select 1 from public.brand_members m where m.brand_id=brands.id and m.user_id=(select auth.uid()) and m.approved_at is not null and m.revoked_at is null)
);
create policy own_drafts_read on public.brand_drafts for select to authenticated using (
 exists(select 1 from public.brand_members m where m.brand_id=brand_drafts.brand_id and m.user_id=(select auth.uid()) and m.approved_at is not null and m.revoked_at is null)
);
create policy own_drafts_insert on public.brand_drafts for insert to authenticated with check (
 updated_by=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2'
 and exists(select 1 from public.brand_members m join public.brands b on b.id=m.brand_id where m.brand_id=brand_drafts.brand_id and m.user_id=(select auth.uid()) and m.approved_at is not null and m.revoked_at is null and b.suspended_at is null)
);
create policy own_drafts_update on public.brand_drafts for update to authenticated using (
 (select auth.jwt()->>'aal')='aal2'
 and exists(select 1 from public.brand_members m join public.brands b on b.id=m.brand_id where m.brand_id=brand_drafts.brand_id and m.user_id=(select auth.uid()) and m.approved_at is not null and m.revoked_at is null and b.suspended_at is null)
) with check (
 updated_by=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2'
 and exists(select 1 from public.brand_members m join public.brands b on b.id=m.brand_id where m.brand_id=brand_drafts.brand_id and m.user_id=(select auth.uid()) and m.approved_at is not null and m.revoked_at is null and b.suspended_at is null)
);
create policy own_revisions on public.brand_revisions for select to authenticated using (
 exists(select 1 from public.brand_members m where m.brand_id=brand_revisions.brand_id and m.user_id=(select auth.uid()) and m.approved_at is not null and m.revoked_at is null)
);
create policy own_publications on public.publication_jobs for select to authenticated using (
 exists(select 1 from public.brand_revisions r join public.brand_members m on m.brand_id=r.brand_id where r.id=publication_jobs.revision_id and m.user_id=(select auth.uid()) and m.approved_at is not null and m.revoked_at is null)
);
create policy own_audit on public.brand_audit for select to authenticated using (
 exists(select 1 from public.brand_members m where m.brand_id=brand_audit.brand_id and m.user_id=(select auth.uid()) and m.approved_at is not null and m.revoked_at is null)
);
create index brand_members_user on public.brand_members(user_id);
create index brand_claims_user on public.brand_claims(user_id);
create index brand_revisions_brand on public.brand_revisions(brand_id);
create index brand_revisions_actor on public.brand_revisions(created_by);
create index brand_drafts_actor on public.brand_drafts(updated_by);
create index brand_audit_brand on public.brand_audit(brand_id);
create index brand_audit_actor on public.brand_audit(actor_id);
create index brand_audit_revision on public.brand_audit(revision_id);
