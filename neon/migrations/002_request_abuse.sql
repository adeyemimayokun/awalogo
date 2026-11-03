-- Atomic admission precedes persistence, email and GitHub work. Keys are server HMACs.
CREATE TABLE public.logo_request_budgets (
 key text PRIMARY KEY, count integer NOT NULL CHECK (count >= 0), expires_at timestamptz NOT NULL
);
CREATE INDEX logo_request_budgets_expiry ON public.logo_request_budgets(expires_at);
CREATE TABLE public.logo_request_receipts (
 submission_id uuid PRIMARY KEY, token_hash text NOT NULL, fingerprint text NOT NULL,
 reply jsonb, expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX logo_request_receipts_expiry ON public.logo_request_receipts(expires_at);
ALTER TABLE public.logo_request_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logo_request_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.logo_request_budgets, public.logo_request_receipts FROM PUBLIC;

CREATE FUNCTION public.claim_logo_request(id uuid, token text, payload text, network text, recipient text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE prior public.logo_request_receipts; existing_token text; bucket record; lease text;
BEGIN
 IF token !~ '^[a-f0-9]{64}$' OR payload !~ '^[a-f0-9]{64}$' OR network !~ '^[a-f0-9]{64}$' OR recipient !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Invalid request admission keys'; END IF;
 -- One lock serializes the shared global budget and UUID claims across instances.
 PERFORM pg_catalog.pg_advisory_xact_lock(732019403);
 DELETE FROM public.logo_request_budgets WHERE expires_at <= now();
 DELETE FROM public.logo_request_receipts WHERE expires_at <= now();
 -- Claims' advisory lock does not cover beginDelivery. Lock the row before
 -- evaluating its phase so a concurrent delivery UPDATE cannot be overwritten.
 SELECT * INTO prior FROM public.logo_request_receipts WHERE submission_id=id FOR UPDATE;
 IF FOUND THEN
   IF prior.token_hash <> token OR prior.fingerprint <> payload THEN RETURN jsonb_build_object('kind','conflict'); END IF;
   IF prior.reply->>'retryStorage' = 'true' OR (prior.reply->>'phase'='storage' AND (prior.reply->>'leaseUntil')::timestamptz <= now()) THEN
     lease := pg_catalog.gen_random_uuid()::text;
     UPDATE public.logo_request_receipts SET reply=jsonb_build_object('phase','storage','leaseId',lease,'leaseUntil',now()+interval '1 minute') WHERE submission_id=id;
     RETURN jsonb_build_object('kind','accepted','leaseId',lease);
   END IF;
   IF (prior.reply->>'status')::integer BETWEEN 200 AND 299 AND EXISTS (
     SELECT 1 FROM public.asset_requests WHERE submission_id=id AND tracking_token_hash=token
   ) THEN RETURN jsonb_build_object('kind','retry','reply',prior.reply); END IF;
   IF prior.reply->>'phase'='delivery' AND EXISTS (
     SELECT 1 FROM public.asset_requests WHERE submission_id=id AND tracking_token_hash=token
   ) THEN
     -- Storage succeeded, but delivery may have completed before a process kill.
     -- Replay storage acceptance without releasing the owner or repeating delivery.
     RETURN jsonb_build_object('kind','retry','reply',jsonb_build_object('status',202,
       'body',jsonb_build_object('ok',true,'issue',NULL,'emailDelivered',false,'deliveryStatus','unconfirmed')));
   END IF;
   RETURN jsonb_build_object('kind','pending');
 END IF;
 -- Old requests remain deduplicated even after the short-lived receipt expires.
 SELECT tracking_token_hash INTO existing_token FROM public.asset_requests WHERE submission_id=id;
 IF FOUND THEN
   RETURN jsonb_build_object('kind',CASE WHEN existing_token=token THEN 'retry' ELSE 'conflict' END,
     'reply',jsonb_build_object('status',202,'body',jsonb_build_object('ok',true,'issue',NULL,'emailDelivered',false)));
 END IF;
 FOR bucket IN SELECT * FROM (VALUES ('network:'||network,5,interval '1 hour'),('recipient:'||recipient,3,interval '1 day'),('global',100,interval '1 day')) AS b(key,lim,ttl) LOOP
   IF EXISTS (SELECT 1 FROM public.logo_request_budgets q WHERE q.key=bucket.key AND q.count>=bucket.lim) THEN
     RETURN jsonb_build_object('kind','limited');
   END IF;
 END LOOP;
 FOR bucket IN SELECT * FROM (VALUES ('network:'||network,interval '1 hour'),('recipient:'||recipient,interval '1 day'),('global',interval '1 day')) AS b(key,ttl) LOOP
   INSERT INTO public.logo_request_budgets(key,count,expires_at) VALUES(bucket.key,1,now()+bucket.ttl)
   ON CONFLICT(key) DO UPDATE SET count=public.logo_request_budgets.count+1;
 END LOOP;
 lease := pg_catalog.gen_random_uuid()::text;
 INSERT INTO public.logo_request_receipts(submission_id,token_hash,fingerprint,reply)
 VALUES(id,token,payload,jsonb_build_object('phase','storage','leaseId',lease,'leaseUntil',now()+interval '1 minute'));
 RETURN jsonb_build_object('kind','accepted','leaseId',lease);
END $$;
REVOKE ALL ON FUNCTION public.claim_logo_request(uuid,text,text,text,text) FROM PUBLIC;
