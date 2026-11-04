CREATE TABLE public.admin_session_revocations (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL
);
CREATE INDEX admin_session_revocations_expiry ON public.admin_session_revocations(expires_at);
ALTER TABLE public.admin_session_revocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_session_revocations FROM PUBLIC;
CREATE FUNCTION public.revoke_admin_session(session_hash text, session_expiry timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 DELETE FROM public.admin_session_revocations WHERE expires_at <= now();
 INSERT INTO public.admin_session_revocations(token_hash,expires_at)
 VALUES(session_hash,session_expiry) ON CONFLICT(token_hash) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.revoke_admin_session(text,timestamptz) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='awalogo_runtime') THEN
  GRANT SELECT,INSERT,DELETE ON public.admin_session_revocations TO awalogo_runtime;
  CREATE POLICY runtime_all ON public.admin_session_revocations TO awalogo_runtime USING(true) WITH CHECK(true);
  GRANT EXECUTE ON FUNCTION public.revoke_admin_session(text,timestamptz) TO awalogo_runtime;
 END IF;
END $$;
