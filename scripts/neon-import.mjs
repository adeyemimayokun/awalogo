import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const keys = {
  asset_requests: ['submission_id'], asset_reports: ['submission_id'],
  admin_plugin_snapshots: ['id'], admin_report_audit: ['id'],
  product_event_daily: ['day', 'event', 'resource', 'format', 'detail'],
  product_event_receipts: ['id'], logo_download_totals: ['slug'],
  logo_download_daily: ['day', 'network_key', 'slug'],
};
const path = process.argv[2];
if (!path) throw new Error('Usage: node --env-file=<target> scripts/neon-import.mjs <private-source-snapshot.json>');
if (!process.env.DATABASE_URL_UNPOOLED) throw new Error('Supply the target DATABASE_URL_UNPOOLED explicitly');
const snapshot = JSON.parse(await readFile(path, 'utf8'));
const sourceProject = process.env.SOURCE_SUPABASE_PROJECT_ID ?? 'cyfhxmhhtvsvfhzmcoot';
assert(/^[a-z0-9]{20}$/.test(sourceProject), 'Invalid expected Supabase project ID');
assert.equal(snapshot.projectId, sourceProject, 'Unexpected Supabase source');
assert(Array.isArray(snapshot.tables), 'Missing source tables');
const seen = new Set();
for (const table of snapshot.tables) {
  assert(Object.hasOwn(keys, table.name), `Unsupported source table: ${table.name}`);
  assert(!seen.has(table.name), 'Duplicate source table'); seen.add(table.name);
  assert(Array.isArray(table.rows) && table.rows.length === table.count, `Incomplete snapshot: ${table.name}`);
}
const url = new URL(process.env.DATABASE_URL_UNPOOLED);
url.searchParams.set('sslmode', 'verify-full');
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('awalogo-data-import'))");
  // Parent records precede their audit rows. Conflicts are verified, never overwritten.
  for (const [name, primary] of Object.entries(keys)) {
    const table = snapshot.tables.find((table) => table.name === name);
    if (!table) continue;
    const json = JSON.stringify(table.rows);
    const join = primary.map((key) => `s."${key}"=t."${key}"`).join(' AND ');
    await client.query(`INSERT INTO public.${name} SELECT * FROM jsonb_populate_recordset(NULL::public.${name},$1::jsonb) ON CONFLICT DO NOTHING`, [json]);
    const { rows } = await client.query(`SELECT count(*)::int AS matched FROM jsonb_populate_recordset(NULL::public.${name},$1::jsonb) s JOIN public.${name} t ON ${join} WHERE to_jsonb(s)=to_jsonb(t)`, [json]);
    assert.equal(rows[0].matched, table.count, `Conflicting or missing data in ${name}; import rolled back`);
    console.log(`${name}: ${table.count} source records verified identical`);
  }
  await client.query('COMMIT');
  console.log(`Imported snapshot captured ${snapshot.capturedAt}; existing records preserved`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(`Import failed (${error.code ?? error.name}): ${error instanceof assert.AssertionError ? error.message : 'transaction rolled back; inspect source and target schemas'}`);
  process.exitCode = 1;
} finally { await client.end(); }
