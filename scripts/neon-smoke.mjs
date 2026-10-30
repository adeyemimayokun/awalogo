import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:5180').origin;
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw new Error('Smoke tests require a loopback development server');
const connection = new URL(process.env.DATABASE_URL_UNPOOLED);
connection.searchParams.set('sslmode', 'verify-full');
const client = new pg.Client({ connectionString: connection.toString(), connectionTimeoutMillis: 15000 });
const id = randomUUID();
const reportId = randomUUID();
const eventId = randomUUID();
const token = randomBytes(32).toString('base64url');
const network = `smoke-${randomUUID()}`;
const day = new Date().toISOString().slice(0, 10);
const key = createHmac('sha256', process.env.DOWNLOAD_HASH_SECRET).update(`${day}:${network}`).digest('hex');
const source = `https://www.figma.com/community/plugin/1661356348996631383?smoke=${id}`;
let hadTotal = true;
async function api(path, method = 'GET', body) {
  const response = await fetch(`${origin}${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', 'x-vercel-forwarded-for': network }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert(response.ok, `${method} ${path.split('?')[0]} returned ${response.status}`);
  return response.json();
}
try {
  await client.connect();
  hadTotal = (await client.query("SELECT 1 FROM public.logo_download_totals WHERE slug='access-bank'")).rowCount > 0;
  assert.equal((await fetch(`${origin}/v2`)).status, 200);
  console.log('PASS app /v2: HTTP 200');
  const request = { submissionId: id, trackingToken: token, institutionName: 'Neon smoke test', officialWebsite: 'https://example.com', email: 'neon-smoke@example.com', category: 'Other', logoAssetUrl: '', notifyWhenAvailable: false, websiteConfirm: '' };
  const saved = await api('/api/logo-requests', 'POST', request);
  assert(saved.trackingUrl);
  await api('/api/logo-requests', 'POST', request);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM public.asset_requests WHERE submission_id=$1', [id])).rows[0].count, 1);
  const status = await api(`/api/logo-requests?token=${token}`);
  assert.equal(status.status, 'pending');
  assert.deepEqual(Object.keys(status).sort(), ['brand_name', 'status', 'updated_at']);
  await api('/api/admin/requests', 'PATCH', { submissionId: id, status: 'in-review' });
  assert.equal((await api(`/api/logo-requests?token=${token}`)).status, 'in-review');
  console.log('PASS request API -> Neon -> private tracking + admin status; duplicate submission stored once');
  await api('/api/logo-requests?view=report', 'POST', { submissionId: reportId, slug: 'access-bank', variation: 'primary', format: 'svg', reason: 'Other', note: 'Synthetic Neon smoke test; not a real report.', officialSource: '', websiteConfirm: '' });
  const reports = await api('/api/admin/catalog?view=reports');
  assert(reports.rows.some((row) => row.submission_id === reportId));
  await api('/api/admin/mutate?view=report-triage', 'POST', { id: reportId, status: 'resolved', note: 'Smoke test resolved' });
  assert.equal((await client.query('SELECT count(*)::int AS count FROM public.admin_report_audit WHERE submission_id=$1', [reportId])).rows[0].count, 1);
  console.log('PASS report API -> Neon -> admin report list + atomic triage audit');
  const before = (await api('/api/logo-requests?view=popularity')).counts['access-bank'] ?? 0;
  await api('/api/logo-requests?view=popularity', 'POST', { slugs: ['access-bank'] });
  await api('/api/logo-requests?view=popularity', 'POST', { slugs: ['access-bank'] });
  assert.equal((await api('/api/logo-requests?view=popularity')).counts['access-bank'], before + 1);
  console.log('PASS download API -> Neon -> totals; daily repeat deduplicated');
  await api('/api/admin/mutate?view=plugin', 'POST', { count: 123, sourceUrl: source, observedAt: new Date().toISOString() });
  assert((await api('/api/admin/catalog?view=plugin')).rows.some((row) => row.source_url === source && row.count === 123));
  console.log('PASS plugin snapshot API -> Neon -> admin metrics');
  await client.query('SELECT public.record_product_event($1,$2,$3,$4,$5)', [eventId, 'neon-smoke', id, null, null]);
  await client.query('SELECT public.record_product_event($1,$2,$3,$4,$5)', [eventId, 'neon-smoke', id, null, null]);
  const event = await client.query('SELECT count::int FROM public.product_event_daily WHERE event=$1 AND resource=$2', ['neon-smoke', id]);
  assert.equal(event.rows[0].count, 1);
  assert.equal((await api('/api/logo-requests?view=events', 'POST', {})).disabled, true);
  console.log('PASS product-event database function; receipts deduplicated and preview analytics remain disabled');
} finally {
  await client.query('BEGIN');
  await client.query('DELETE FROM public.admin_report_audit WHERE submission_id=$1', [reportId]);
  await client.query('DELETE FROM public.asset_reports WHERE submission_id=$1', [reportId]);
  await client.query('DELETE FROM public.asset_requests WHERE submission_id=$1', [id]);
  await client.query('DELETE FROM public.admin_plugin_snapshots WHERE source_url=$1', [source]);
  await client.query('DELETE FROM public.product_event_receipts WHERE id=$1', [eventId]);
  await client.query('DELETE FROM public.product_event_daily WHERE event=$1 AND resource=$2', ['neon-smoke', id]);
  await client.query(`WITH removed AS (DELETE FROM public.logo_download_daily WHERE day=$1 AND network_key=$2 RETURNING slug)
    UPDATE public.logo_download_totals SET downloads=downloads-1 WHERE slug IN (SELECT slug FROM removed)`, [day, key]);
  if (!hadTotal) await client.query("DELETE FROM public.logo_download_totals WHERE slug='access-bank' AND downloads=0");
  await client.query('COMMIT');
  await client.end();
  console.log('Cleaned up this run\'s synthetic database rows');
}
