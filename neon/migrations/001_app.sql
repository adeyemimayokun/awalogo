-- Server-only application tables. No Supabase auth schema or public API grants.
CREATE TABLE IF NOT EXISTS public.asset_requests (
 submission_id uuid PRIMARY KEY, brand_name text NOT NULL, website text NOT NULL,
 category text NOT NULL, contact_email text NOT NULL, asset_url text,
 notify_when_available boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in-review','needs-info','approved','completed','rejected')),
 tracking_token_hash text NOT NULL UNIQUE, github_issue_number integer,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.admin_plugin_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), count bigint NOT NULL CHECK(count>=0), source_url text NOT NULL,
 observed_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), recorded_by text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.asset_reports (
 submission_id uuid PRIMARY KEY, slug text NOT NULL, variation text NOT NULL, format text NOT NULL, reason text NOT NULL,
 note text NOT NULL DEFAULT '', official_source text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in-review','resolved','dismissed')),
 resolution_note text NOT NULL DEFAULT '', updated_by text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.admin_report_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.asset_reports(submission_id),
 status text NOT NULL, note text NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.product_event_daily (
 day date NOT NULL, event text NOT NULL, resource text NOT NULL DEFAULT '', format text NOT NULL DEFAULT '', detail text NOT NULL DEFAULT '',
 count bigint NOT NULL DEFAULT 0, PRIMARY KEY(day,event,resource,format,detail)
);
CREATE TABLE IF NOT EXISTS public.product_event_receipts (id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.logo_download_totals (
 slug text PRIMARY KEY CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), downloads bigint NOT NULL DEFAULT 0 CHECK(downloads>=0)
);
CREATE TABLE IF NOT EXISTS public.logo_download_daily (
 day date NOT NULL DEFAULT current_date, network_key text NOT NULL CHECK(network_key ~ '^[a-f0-9]{64}$'), slug text NOT NULL,
 PRIMARY KEY(day,network_key,slug)
);
CREATE FUNCTION public.record_product_event(event_id uuid,event_name text,resource_id text,event_format text,event_detail text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 DELETE FROM public.product_event_receipts WHERE created_at < now()-interval '2 days';
 INSERT INTO public.product_event_receipts(id) VALUES(event_id) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO public.product_event_daily(day,event,resource,format,detail,count)
 VALUES((now() AT TIME ZONE 'UTC')::date,event_name,coalesce(resource_id,''),coalesce(event_format,''),coalesce(event_detail,''),1)
 ON CONFLICT(day,event,resource,format,detail) DO UPDATE SET count=public.product_event_daily.count+1;
END $$;
CREATE FUNCTION public.triage_asset_report(report_id uuid,next_status text,resolution text,actor text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF next_status IS NULL OR next_status NOT IN ('pending','in-review','resolved','dismissed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF resolution IS NULL OR (next_status IN ('resolved','dismissed') AND length(trim(resolution))<5) THEN RAISE EXCEPTION 'Resolution note required'; END IF;
 UPDATE public.asset_reports SET status=next_status,resolution_note=resolution,updated_by=actor,updated_at=now() WHERE submission_id=report_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
 INSERT INTO public.admin_report_audit(submission_id,status,note,actor) VALUES(report_id,next_status,resolution,actor);
END $$;
CREATE FUNCTION public.record_logo_downloads(requested_slugs text[],network_key text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF requested_slugs IS NULL OR cardinality(requested_slugs) NOT BETWEEN 1 AND 50 OR network_key IS NULL OR network_key !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Invalid download event';
 END IF;
 DELETE FROM public.logo_download_daily WHERE day < current_date-2;
 WITH accepted AS (
  INSERT INTO public.logo_download_daily(day,network_key,slug)
  SELECT current_date,record_logo_downloads.network_key,s FROM (SELECT DISTINCT unnest(requested_slugs) AS s) selected
  ON CONFLICT DO NOTHING RETURNING slug
 )
 INSERT INTO public.logo_download_totals(slug,downloads) SELECT slug,1 FROM accepted
 ON CONFLICT(slug) DO UPDATE SET downloads=public.logo_download_totals.downloads+1;
END $$;
ALTER TABLE public.asset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_plugin_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_report_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_event_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_event_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logo_download_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logo_download_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asset_requests,public.admin_plugin_snapshots,public.asset_reports,public.admin_report_audit,
 public.product_event_daily,public.product_event_receipts,public.logo_download_totals,public.logo_download_daily FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_product_event(uuid,text,text,text,text),public.triage_asset_report(uuid,text,text,text),
 public.record_logo_downloads(text[],text) FROM PUBLIC;
