import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

process.loadEnvFile('.env.neon-production.local');
assert.equal(process.env.NEON_BRANCH, 'production', 'Production verification requires the production Neon branch');
const origin = new URL(process.argv[2] ?? 'https://www.awalogo.com').origin;
assert(/^https:\/\/(www\.)?awalogo\.com$/.test(origin) || /^https:\/\/nigerian-bank-logos-[a-z0-9]+-ship-with-ai\.vercel\.app$/.test(origin), 'Unexpected production host');
const url = new URL(process.env.DATABASE_URL_UNPOOLED);
url.searchParams.set('sslmode', 'verify-full');
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000 });
const id = randomUUID();
const token = randomBytes(32).toString('base64url');
const hash = createHash('sha256').update(token).digest('hex');
const slug = `neon-smoke-${id}`;
async function api(path, expected = 200, init = {}) {
  const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(30000), ...init });
  assert.equal(response.status, expected, `${init.method ?? 'GET'} ${path.split('?')[0]} status`);
  return response.json();
}
try {
  await client.connect();
  assert.equal((await fetch(`${origin}/`)).status, 200);
  assert.equal((await fetch(`${origin}/v2`)).status, 200);
  assert.equal((await fetch(`${origin}/v2/flags`)).status, 200);
  console.log('PASS production V1, V2, and flags: HTTP 200');
  const snapshot = JSON.parse(await readFile('.vercel/source-production-snapshot.json', 'utf8'));
  assert.equal(snapshot.projectId, 'btrehjfxhqfwfpxrdyhl');
  const source = snapshot.tables.find((table) => table.name === 'asset_requests');
  const matched = await client.query('SELECT count(*)::int AS count FROM jsonb_populate_recordset(NULL::public.asset_requests,$1::jsonb) s JOIN public.asset_requests t USING(submission_id) WHERE to_jsonb(s)=to_jsonb(t)', [JSON.stringify(source.rows)]);
  assert.equal(matched.rows[0].count, source.count);
  console.log(`PASS all ${source.count} source production requests preserved field-for-field`);
  await client.query("INSERT INTO public.asset_requests(submission_id,brand_name,website,category,contact_email,tracking_token_hash) VALUES($1,'Synthetic production verification','https://example.com','Other','verification@example.invalid',$2)", [id, hash]);
  const tracking = await api(`/api/logo-requests?token=${token}`);
  assert.equal(tracking.brand_name, 'Synthetic production verification');
  assert.deepEqual(Object.keys(tracking).sort(), ['brand_name', 'status', 'updated_at']);
  console.log('PASS deployed private tracking API reads production Neon; private contact fields excluded');
  const { counts } = await api('/api/logo-requests?view=popularity');
  assert(counts && typeof counts === 'object');
  await api('/api/admin/requests', 401);
  await api('/api/admin/catalog?view=reports', 401);
  await api('/api/logo-requests', 403, { method: 'POST', headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json' }, body: '{}' });
  console.log('PASS statistics available, admin authentication enforced, cross-origin writes rejected');
  await client.query('BEGIN');
  await client.query("INSERT INTO public.asset_reports(submission_id,slug,variation,format,reason) VALUES($1,$2,'primary','svg','Wrong asset')", [id, slug]);
  await client.query('SELECT public.triage_asset_report($1,$2,$3,$4)', [id, 'resolved', 'Synthetic verification', 'migration-verification']);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM public.admin_report_audit WHERE submission_id=$1', [id])).rows[0].count, 1);
  for (let i = 0; i < 2; i++) {
    await client.query('SELECT public.record_logo_downloads($1,$2)', [[slug], hash]);
    await client.query('SELECT public.record_product_event($1,$2,$3,$4,$5)', [id, 'migration-verification', slug, null, null]);
  }
  assert.equal((await client.query('SELECT downloads::int AS count FROM public.logo_download_totals WHERE slug=$1', [slug])).rows[0].count, 1);
  assert.equal((await client.query('SELECT count::int FROM public.product_event_daily WHERE resource=$1', [slug])).rows[0].count, 1);
  await client.query('ROLLBACK');
  console.log('PASS report triage/audit and event/download deduplication; test transaction rolled back');
  const catalog = JSON.parse(await readFile('apps/web/public/catalog/v1/catalog.json', 'utf8'));
  assert.deepEqual(await (await fetch(`${origin}/catalog/v1/catalog.json`)).json(), catalog);
  const flags = JSON.parse(await readFile('apps/web/src/generated/flags.json', 'utf8'));
  const expansion = JSON.parse(await readFile('packages/brands/catalog.json', 'utf8'));
  for (const asset of [catalog.items[0].logo.formats[0], expansion.brands[0].formats[0], flags.countries.find((flag) => flag.code === 'NG').variants[0].formats[0]]) {
    const response = await fetch(`${origin}${asset.url}`);
    assert.equal(response.status, 200);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), asset.checksum);
  }
  console.log('PASS V1 catalog unchanged; legacy logo, V2 logo, and flag checksums match');
} finally {
  await client.query('ROLLBACK').catch(() => undefined);
  await client.query('DELETE FROM public.asset_requests WHERE submission_id=$1', [id]);
  await client.end();
  console.log('Removed synthetic verification request; no emails or GitHub issues sent');
}
