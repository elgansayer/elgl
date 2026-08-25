-- Client crash telemetry is ingested only through the NestJS analytics endpoint.
-- Browser Supabase roles must never be able to read crash messages, stack traces,
-- URLs, user agents, or write arbitrary rows directly.
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.client_errors FROM anon, authenticated;
GRANT ALL ON TABLE public.client_errors TO service_role;

-- No anon/authenticated policies are intentionally created. The backend uses the
-- service-role client and therefore remains able to insert and operate on rows.
