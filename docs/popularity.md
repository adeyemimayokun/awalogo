# V2 Popularity Ranking

The default order combines 60% editorial company prominence and 40% aggregate download demand. The starting scores in `apps/web/src/popularity.ts` are editable editorial judgments, not measured market share. Unlisted companies start equally at 20. Downloads are log-scaled and saturate at 1,000 counted downloads. Ties sort by name, then slug.

Only successfully prepared individual and ZIP downloads count. Copying code and previewing do not. ZIP downloads count each company once. A company counts once per network per UTC day to reduce repeat inflation; this can undercount shared networks. No historical counts are fabricated or backfilled. The server stores only a daily HMAC network key for deduplication, never raw IP addresses, email addresses, or cookies. Deduplication rows expire after two days and are pruned on subsequent events. Totals persist.

## Activation

Run `supabase/popularity.sql` against the same production Supabase project configured by Vercel's `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then deploy. The tables and RPC are service-role-only with RLS enabled. The API uses the existing logo request function's `?view=popularity` branch, so no extra serverless function is created. GET exposes only aggregate counts; POST validates catalog slugs and same-origin requests. Downloads never fail because tracking is unavailable.

Until the database setup is applied, the gallery uses the editorial baseline. The plain Vite development server does not serve Vercel APIs; use the deployed API or Vercel development runtime to verify persistent counts. This implementation covers V2 web downloads, not V1 or Figma insertion events.
