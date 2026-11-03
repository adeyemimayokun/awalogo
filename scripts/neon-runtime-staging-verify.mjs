import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { provision, role, verify } from './neon-runtime-role.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = new URL('../neon/migrations/', import.meta.url);
const hash = (sql) => createHash('sha256').update(sql).digest('hex');
const q = (s) => `"${s.replaceAll('"', '""')}"`;

export function stagingConnection(env) {
  assert.equal(env.NEON_BRANCH, 'staging', 'Staging branch marker required');
  const url = new URL(env.DATABASE_URL_UNPOOLED);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'PostgreSQL URL required');
  assert.ok(url.hostname.endsWith('.neon.tech') && !url.hostname.includes('-pooler'), 'Direct Neon endpoint required');
  assert.ok(url.username && url.password, 'Owner credential required');
  url.searchParams.set('sslmode', 'verify-full');
  return url;
}

export function childEnvironment(env = process.env) {
  // No inherited PG*, DATABASE_*, NODE_OPTIONS, or other env-file credentials.
  return { ...(env.PATH ? { PATH: env.PATH } : {}) };
}

export function validateMigration(sql) {
  // Migrations are trusted reviewed repository SQL, but cannot escape this transaction.
  assert.doesNotMatch(sql, /^\s*(?:COMMIT\b|END\s*;|ROLLBACK\b|ABORT\b|BEGIN\s*;|START\s+TRANSACTION\b|PREPARE\s+TRANSACTION\b)/im,
    'Transaction control is forbidden in verification migrations');
}

export function successSummary(checks, pending) {
  assert.ok(Number.isSafeInteger(checks) && checks >= 0);
  assert.ok(Number.isSafeInteger(pending) && pending >= 0);
  return `PASS staging runtime verification: ${checks} checks; ${pending} pending migrations rehearsed; all changes rolled back`;
}

export function safeFailure(stage, error) {
  const code = /^[0-9A-Z]{5}$/.test(error?.code ?? '') ? ` SQLSTATE=${error.code}` : '';
  const kind = error?.code === 'ERR_ASSERTION' ? ' assertion failed' : '';
  return new Error(`Staging verification failed at ${stage}${code}${kind}`);
}

export async function runStaging() {
  // Parse this ONE file; do not merge it into inherited process.env.
  const env = parseEnv(await readFile(new URL('../.env.neon-staging.local', import.meta.url), 'utf8'));
  const connection = stagingConnection(env);
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: connection.toString(), connectionTimeoutMillis: 15000,
    statement_timeout: 15000, query_timeout: 20000 });
  const migrations = [];
  for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(name, directory), 'utf8');
    validateMigration(sql);
    migrations.push({ name, sql, checksum: hash(sql) });
  }
  const id = randomUUID();
  const report = randomUUID();
  const snapshot = randomUUID();
  const event = randomUUID();
  const slug = `sec07-${randomBytes(12).toString('hex')}`;
  const privateSchema = `sec07_${randomBytes(12).toString('hex')}`;
  const key = () => randomBytes(32).toString('hex');
  let checks = 0;
  let stage = 'connect';
  let begun = false;
  let rolledBack = false;
  let pending = [];
  let failure;
  let baselineVerified = false;
  let owner;
  const pass = () => { checks++; };
  const scalar = async (sql, values) => (await client.query(sql, values)).rows[0];
  try {
    await client.connect();
    stage = 'exclusive staging verifier lock';
    const lock = await scalar("SELECT pg_try_advisory_lock(hashtext('awalogo-staging-runtime-verifier')) AS acquired");
    assert.equal(lock.acquired, true, 'Another staging verifier is running');
    stage = 'transaction';
    await client.query('BEGIN');
    begun = true;
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('awalogo-migrations'))");
    owner = (await scalar('SELECT current_user AS owner')).owner;
    assert.equal((await scalar('SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS present', [role])).present, false,
      'Runtime role already exists; refusing to modify it');
    const applied = await client.query('SELECT name, checksum FROM public.awalogo_migrations');
    const byName = new Map(applied.rows.map((row) => [row.name, row.checksum]));
    pending = migrations.filter((migration) => !byName.has(migration.name));
    for (const migration of migrations) {
      if (byName.has(migration.name)) assert.equal(byName.get(migration.name), migration.checksum, 'Applied migration checksum mismatch');
    }
    // Fresh abuse tables isolate expiry/quota operations from ALL pre-existing records.
    assert.equal((await scalar("SELECT to_regclass('public.logo_request_budgets') IS NULL AND to_regclass('public.logo_request_receipts') IS NULL AS absent")).absent,
      true, 'Abuse tables already exist; this pending-migration rehearsal requires fresh tables');
    baselineVerified = true;
    stage = 'pending migrations';
    for (const migration of pending) {
      assert.equal(hash(await readFile(new URL(migration.name, directory), 'utf8')), migration.checksum, 'Migration changed during verification');
      await client.query(migration.sql);
    }
    pass();
    stage = 'runtime provisioning audit';
    await provision({ query: (sql, values) => sql === 'BEGIN' ? Promise.resolve({ rows: [] }) : client.query(sql, values) }, key(), { neon: true });
    pass();
    stage = 'private fixture schema';
    await client.query(`CREATE SCHEMA ${q(privateSchema)}; CREATE TABLE ${q(privateSchema)}.secret(value text)`);
    // Existing invoker routines delete expired receipts/dedup rows. Restrict their
    // cleanup to our fixtures even though the enclosing transaction rolls back.
    stage = 'event cleanup isolation policy';
    await client.query(`CREATE POLICY sec07_cleanup ON public.product_event_receipts AS RESTRICTIVE FOR DELETE TO ${role} USING (id='${event}'::uuid)`);
    stage = 'download cleanup isolation policy';
    await client.query(`CREATE POLICY sec07_cleanup ON public.logo_download_daily AS RESTRICTIVE FOR DELETE TO ${role} USING (slug='${slug}')`);
    stage = 'test-only owner SET membership';
    // Neon CREATEROLE does not imply SET ROLE on a newly-created login. Give the
    // existing owner permission to impersonate runtime, NEVER the reverse.
    await client.query(`GRANT ${role} TO ${q(owner)} WITH INHERIT FALSE, SET TRUE`);
    await verify(client);
    stage = 'SET LOCAL ROLE runtime';
    await client.query(`SET LOCAL ROLE ${role}`);
    assert.equal((await scalar('SELECT current_user AS role')).role, role);
    pass();
    const denied = async (sql, values) => {
      await client.query('SAVEPOINT sec07_denial');
      await assert.rejects(client.query(sql, values), (error) => error.code === '42501');
      await client.query('ROLLBACK TO SAVEPOINT sec07_denial');
      pass();
    };
    stage = 'denied privileges';
    for (const sql of [
      `CREATE TABLE public.${q(slug)}(id int)`, `CREATE SCHEMA ${q(slug)}`,
      `CREATE TEMP TABLE ${q(slug)}(id int)`, `CREATE ROLE ${q(slug)}`,
      'ALTER TABLE public.asset_requests ADD COLUMN sec07_forbidden int',
      'SELECT * FROM public.awalogo_migrations', `SELECT * FROM ${q(privateSchema)}.secret`,
      'TRUNCATE public.asset_requests',
    ]) await denied(sql);
    await denied('DELETE FROM public.asset_requests WHERE submission_id=$1', [id]);
    await denied('UPDATE public.asset_requests SET contact_email=$1 WHERE submission_id=$2', ['never@example.invalid', id]);
    stage = 'request/report/snapshot operations';
    const token = key(), payload = key(), network = key(), recipient = key();
    const claim = async (requestId = id, t = token, p = payload, n = network, r = recipient) =>
      (await scalar('SELECT public.claim_logo_request($1,$2,$3,$4,$5) AS decision', [requestId, t, p, n, r])).decision;
    const first = await claim();
    assert.equal(first.kind, 'accepted');
    assert.ok(first.leaseId);
    pass();
    await client.query(`INSERT INTO public.asset_requests(submission_id,brand_name,website,category,contact_email,tracking_token_hash)
      VALUES($1,'SEC07 staging fixture','https://example.invalid','Other','sec07@example.invalid',$2)`, [id, token]);
    await client.query("UPDATE public.asset_requests SET status='in-review',updated_at=now() WHERE submission_id=$1", [id]);
    assert.equal((await scalar('SELECT status FROM public.asset_requests WHERE submission_id=$1', [id])).status, 'in-review');
    pass();
    await client.query(`INSERT INTO public.asset_reports(submission_id,slug,variation,format,reason) VALUES($1,$2,'primary','svg','test')`, [report, slug]);
    await client.query('SELECT public.triage_asset_report($1,$2,$3,$4)', [report, 'resolved', 'SEC07 synthetic resolution', 'sec07']);
    assert.equal((await scalar('SELECT status FROM public.asset_reports WHERE submission_id=$1', [report])).status, 'resolved');
    pass();
    await client.query(`INSERT INTO public.admin_plugin_snapshots(id,count,source_url,observed_at,recorded_by) VALUES($1,1,'https://example.invalid',now(),'sec07')`, [snapshot]);
    assert.equal((await scalar('SELECT count FROM public.admin_plugin_snapshots WHERE id=$1', [snapshot])).count, '1');
    pass();
    stage = 'event/download invoker operations';
    for (let i = 0; i < 2; i++) await client.query('SELECT public.record_product_event($1,$2,$3,$4,$5)', [event, 'sec07', slug, '', '']);
    assert.equal((await scalar('SELECT count FROM public.product_event_daily WHERE event=$1 AND resource=$2', ['sec07', slug])).count, '1');
    pass();
    for (let i = 0; i < 2; i++) await client.query('SELECT public.record_logo_downloads($1,$2)', [[slug], network]);
    assert.equal((await scalar('SELECT downloads FROM public.logo_download_totals WHERE slug=$1', [slug])).downloads, '1');
    pass();
    stage = 'claim idempotency and storage leases';
    assert.equal((await claim()).kind, 'pending');
    assert.equal((await claim(id, key())).kind, 'conflict');
    assert.equal((await claim(id, token, key())).kind, 'conflict');
    pass();
    const quotaBefore = await client.query('SELECT key,count FROM public.logo_request_budgets ORDER BY key');
    await client.query('UPDATE public.logo_request_receipts SET reply=$1 WHERE submission_id=$2', [{ retryStorage: true, leaseId: first.leaseId }, id]);
    const reclaimed = await claim();
    assert.equal(reclaimed.kind, 'accepted');
    assert.notEqual(reclaimed.leaseId, first.leaseId);
    const stale = await client.query("UPDATE public.logo_request_receipts SET reply=$1 WHERE submission_id=$2 AND reply->>'leaseId'=$3 RETURNING submission_id", [{ phase: 'delivery' }, id, first.leaseId]);
    assert.equal(stale.rowCount, 0);
    pass();
    await client.query('UPDATE public.logo_request_receipts SET reply=$1 WHERE submission_id=$2', [{ phase: 'storage', leaseId: reclaimed.leaseId, leaseUntil: '2000-01-01T00:00:00Z' }, id]);
    const expired = await claim();
    assert.equal(expired.kind, 'accepted');
    assert.notEqual(expired.leaseId, reclaimed.leaseId);
    pass();
    const delivery = await client.query(`UPDATE public.logo_request_receipts SET reply=$1 WHERE submission_id=$2
      AND reply->>'leaseId'=$3 AND reply->>'phase'='storage' AND (reply->>'leaseUntil')::timestamptz>now() RETURNING submission_id`,
    [{ phase: 'delivery', leaseId: expired.leaseId }, id, expired.leaseId]);
    assert.equal(delivery.rowCount, 1);
    const deliveryMarker = (await scalar('SELECT reply FROM public.logo_request_receipts WHERE submission_id=$1', [id])).reply;
    const unconfirmed = await claim();
    assert.equal(unconfirmed.kind, 'retry');
    assert.equal(unconfirmed.reply.status, 202);
    assert.equal(unconfirmed.reply.body.deliveryStatus, 'unconfirmed');
    assert.equal((await claim(id, key())).kind, 'conflict');
    assert.deepEqual((await scalar('SELECT reply FROM public.logo_request_receipts WHERE submission_id=$1', [id])).reply, deliveryMarker);
    pass();
    const reply = { status: 202, body: { ok: true } };
    await client.query('UPDATE public.logo_request_receipts SET reply=$1 WHERE submission_id=$2', [reply, id]);
    assert.deepEqual(await claim(), { kind: 'retry', reply });
    assert.equal((await claim(id, key())).kind, 'conflict');
    assert.deepEqual((await client.query('SELECT key,count FROM public.logo_request_budgets ORDER BY key')).rows, quotaBefore.rows);
    pass();
    const missingId = randomUUID(), missingToken = key(), missingPayload = key(), missingNetwork = key(), missingRecipient = key();
    assert.equal((await claim(missingId, missingToken, missingPayload, missingNetwork, missingRecipient)).kind, 'accepted');
    await client.query('UPDATE public.logo_request_receipts SET reply=$1 WHERE submission_id=$2', [{ phase: 'delivery', leaseId: key() }, missingId]);
    assert.equal((await claim(missingId, missingToken, missingPayload, missingNetwork, missingRecipient)).kind, 'pending');
    await client.query('UPDATE public.logo_request_receipts SET reply=$1 WHERE submission_id=$2', [reply, missingId]);
    assert.equal((await claim(missingId, missingToken, missingPayload, missingNetwork, missingRecipient)).kind, 'pending');
    pass();
    stage = 'recipient/network/global quotas';
    // Recipient limit=3, with distinct network keys.
    const limitedRecipient = key();
    for (let i = 0; i < 4; i++) assert.equal((await claim(randomUUID(), key(), key(), key(), limitedRecipient)).kind, i < 3 ? 'accepted' : 'limited');
    pass();
    const limitedNetwork = key();
    for (let i = 0; i < 6; i++) assert.equal((await claim(randomUUID(), key(), key(), limitedNetwork, key())).kind, i < 5 ? 'accepted' : 'limited');
    pass();
    const total = Number((await scalar("SELECT count FROM public.logo_request_budgets WHERE key='global'")).count);
    for (let i = total; i < 101; i++) assert.equal((await claim(randomUUID(), key(), key(), key(), key())).kind, i < 100 ? 'accepted' : 'limited');
    assert.equal(Number((await scalar("SELECT count FROM public.logo_request_budgets WHERE key='global'")).count), 100);
    pass();
    stage = 'migration stability check';
    assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith('.sql')).sort(), migrations.map((migration) => migration.name));
    for (const migration of migrations) {
      assert.equal(hash(await readFile(new URL(migration.name, directory), 'utf8')), migration.checksum, 'Migration changed during verification');
    }
    stage = 'rollback';
  } catch (error) {
    failure = safeFailure(stage, error);
  } finally {
    try {
      if (begun) {
        stage = 'rollback execution';
        await client.query('ROLLBACK');
        rolledBack = true;
        console.log('PASS rollback completed (no commit or credential output)');
      }
      if (rolledBack && baselineVerified) {
        stage = 'post-rollback owner restoration';
        assert.equal((await scalar('SELECT current_user AS owner')).owner, owner);
        stage = 'post-rollback runtime role absence';
        assert.equal((await scalar('SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS present', [role])).present, false);
        stage = 'post-rollback abuse tables absence';
        assert.equal((await scalar("SELECT to_regclass('public.logo_request_budgets') IS NULL AND to_regclass('public.logo_request_receipts') IS NULL AS absent")).absent, true);
        stage = 'post-rollback private schema absence';
        assert.equal((await scalar('SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1) AS present', [privateSchema])).present, false);
        stage = 'post-rollback request absence';
        assert.equal((await scalar('SELECT EXISTS(SELECT 1 FROM public.asset_requests WHERE submission_id=$1) AS present', [id])).present, false);
        stage = 'post-rollback all synthetic records absence';
        assert.equal((await scalar(`SELECT
          NOT EXISTS(SELECT 1 FROM public.asset_reports WHERE submission_id=$1) AND
          NOT EXISTS(SELECT 1 FROM public.admin_report_audit WHERE submission_id=$1) AND
          NOT EXISTS(SELECT 1 FROM public.admin_plugin_snapshots WHERE id=$2) AND
          NOT EXISTS(SELECT 1 FROM public.product_event_receipts WHERE id=$3) AND
          NOT EXISTS(SELECT 1 FROM public.product_event_daily WHERE event='sec07' AND resource=$4) AND
          NOT EXISTS(SELECT 1 FROM public.logo_download_totals WHERE slug=$4) AND
          NOT EXISTS(SELECT 1 FROM public.logo_download_daily WHERE slug=$4) AS absent`, [report, snapshot, event, slug])).absent, true);
        pass();
        console.log('PASS post-rollback role/tables/schema/all synthetic records absent');
      }
    } catch (error) {
      const cleanupFailure = safeFailure(stage, error);
      failure = failure ? new Error(`${failure.message}; ${cleanupFailure.message}`) : cleanupFailure;
    } finally {
      try {
        // Closing the session also releases the verifier lock, AFTER absence checks.
        await client.end();
      } catch (error) {
        const closeFailure = safeFailure('session close', error);
        failure = failure ? new Error(`${failure.message}; ${closeFailure.message}`) : closeFailure;
      }
    }
  }
  if (failure) throw failure;
  console.log(successSummary(checks, pending.length));
}

export function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== '--staging') throw new Error('Explicit --staging required');
  // The child has a clean environment and reads exactly one fixed staging file.
  const source = `import { runStaging } from ${JSON.stringify(import.meta.url)}; runStaging().catch(error => { console.error(error.message.startsWith('Staging verification failed at ') ? error.message : 'Staging verification failed (details suppressed)'); process.exitCode=1; });`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: root, env: childEnvironment(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw new Error('Isolated staging verifier did not complete');
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { console.error('Staging verification requires --staging; details suppressed.'); process.exitCode = 1; }
}
