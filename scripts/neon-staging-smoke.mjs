import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

process.loadEnvFile('.env.neon-staging.local');
assert.equal(process.env.NEON_BRANCH, 'staging', 'This test must use the Neon staging branch');
const origin = 'https://nigerian-bank-logos-git-staging-ship-with-ai.vercel.app';
const url = new URL(process.env.DATABASE_URL_UNPOOLED);
url.searchParams.set('sslmode', 'verify-full');
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000 });
const id = randomUUID();
const reportId = randomUUID();
const token = randomBytes(32).toString('base64url');
async function api(path, method = 'GET', body, expected = 200) {
  const response = await fetch(`${origin}${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, expected, `${method} ${path.split('?')[0]} status`);
  return response.json();
}
try {
  await client.connect();
  assert.equal((await fetch(`${origin}/v2`)).status, 200);
  assert.equal((await fetch(`${origin}/v2/flags`)).status, 200);
  console.log('PASS Vercel staging /v2 and /v2/flags: HTTP 200');
  const body = { submissionId: id, trackingToken: token, institutionName: 'Neon staging verification', officialWebsite: 'https://example.com', email: 'staging-test@example.com', category: 'Other', logoAssetUrl: '', notifyWhenAvailable: false, websiteConfirm: '' };
  const saved = await api('/api/logo-requests', 'POST', body, 202);
  assert.equal(saved.emailDelivered, false); assert.equal(saved.issue, null); assert(saved.trackingUrl);
  await api('/api/logo-requests', 'POST', body, 202);
  const stored = await client.query('SELECT tracking_token_hash FROM public.asset_requests WHERE submission_id=$1', [id]);
  assert.equal(stored.rowCount, 1);
  assert.equal(stored.rows[0].tracking_token_hash, createHash('sha256').update(token).digest('hex'));
  const status = await api(`/api/logo-requests?token=${token}`);
  assert.equal(status.status, 'pending');
  assert.deepEqual(Object.keys(status).sort(), ['brand_name', 'status', 'updated_at']);
  console.log('PASS deployed request POST -> Neon -> private tracking GET; duplicate stored once; no email/GitHub delivery');
  await api('/api/logo-requests?view=report', 'POST', { submissionId: reportId, slug: 'access-bank', variation: 'primary', format: 'svg', reason: 'Wrong asset', note: 'Synthetic staging verification, not a real report' }, 202);
  assert.equal((await client.query('SELECT status FROM public.asset_reports WHERE submission_id=$1', [reportId])).rows[0].status, 'pending');
  console.log('PASS deployed report POST -> Neon; no maintainer notification');
  await api('/api/admin/requests', 'GET', undefined, 401);
  await api('/api/admin/catalog?view=reports', 'GET', undefined, 401);
  console.log('PASS private admin data requires authentication on staging');
  const { counts } = await api('/api/logo-requests?view=popularity');
  const totals = await client.query('SELECT slug,downloads FROM public.logo_download_totals');
  for (const [slug, count] of Object.entries(counts)) assert.equal(count, Number(totals.rows.find((row) => row.slug === slug)?.downloads));
  assert.equal((await api('/api/logo-requests?view=events', 'POST', {}, 202)).disabled, true);
  console.log('PASS deployed popularity reads Neon; preview product analytics remain disabled');
  const catalog = JSON.parse(await readFile('apps/web/public/catalog/v1/catalog.json', 'utf8'));
  const served = await (await fetch(`${origin}/catalog/v1/catalog.json`)).json();
  assert.deepEqual(served, catalog);
  const flags = JSON.parse(await readFile('apps/web/src/generated/flags.json', 'utf8'));
  const expansion = JSON.parse(await readFile('packages/brands/catalog.json', 'utf8'));
  const samples = [catalog.items[0].logo.formats[0], expansion.brands[0].formats[0], flags.countries.find((flag) => flag.code === 'NG').variants[0].formats[0]];
  for (const asset of samples) {
    const response = await fetch(`${origin}${asset.url}`);
    assert.equal(response.status, 200);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), asset.checksum);
  }
  console.log('PASS V1 catalog identical; legacy logo, V2 logo, and flag downloads match existing asset checksums');
} finally {
  await client.query('BEGIN');
  await client.query('DELETE FROM public.asset_reports WHERE submission_id=$1', [reportId]);
  await client.query('DELETE FROM public.asset_requests WHERE submission_id=$1', [id]);
  await client.query('COMMIT');
  await client.end();
  console.log('Removed synthetic staging request/report rows');
}
