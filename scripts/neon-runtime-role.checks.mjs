import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { grants, functions, plan, provision, scramVerifier, verify, parseArgs, runtimeConnection } from './neon-runtime-role.mjs';
import { childEnvironment, stagingConnection, validateMigration, successSummary, safeFailure } from './neon-runtime-staging-verify.mjs';

test('cleanup failures identify safe stages without exposing assertion or SQL values', () => {
  const secret = 'postgresql://owner:private-password@example.invalid/customer';
  const sqlError = Object.assign(new Error(secret), { code: '42501', detail: secret });
  assert.equal(safeFailure('post-rollback runtime role absence', sqlError).message,
    'Staging verification failed at post-rollback runtime role absence SQLSTATE=42501');
  const assertion = Object.assign(new Error(secret), { code: 'ERR_ASSERTION', actual: secret, expected: 'private' });
  assert.equal(safeFailure('post-rollback all synthetic records absence', assertion).message,
    'Staging verification failed at post-rollback all synthetic records absence assertion failed');
  assert.doesNotMatch(safeFailure('session close', assertion).message, /postgresql|private|customer/);
});

test('claim reads and locks receipt before evaluating lease or updating it', async () => {
  const directory = new URL('../neon/migrations/', import.meta.url);
  const sources = [];
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    sources.push(await readFile(new URL(file, directory), 'utf8'));
  }
  const sql = sources.join('\n');
  const lockingRead = /SELECT\s+\*\s+INTO\s+prior\s+FROM\s+public\.logo_request_receipts\s+WHERE\s+submission_id\s*=\s*id\s+FOR\s+UPDATE\s*;/i.exec(sql);
  assert.ok(lockingRead, 'Receipt locking read required');
  assert.ok(lockingRead.index < sql.indexOf("prior.reply->>'retryStorage'"));
  assert.ok(lockingRead.index < sql.indexOf('UPDATE public.logo_request_receipts SET reply='));
});

test('staging success output contains only counts and rollback status', () => {
  assert.equal(successSummary(28, 1), 'PASS staging runtime verification: 28 checks; 1 pending migrations rehearsed; all changes rolled back');
  assert.doesNotMatch(successSummary(28, 1), /postgres(?:ql)?:\/\/|password|leaseId|tracking_token|DATABASE_URL|@/);
  assert.throws(() => successSummary('owner-secret', 1));
  assert.throws(() => successSummary(28, 'postgresql://owner:secret@example.invalid'));
});

test('staging verifier isolates credentials and refuses implicit or non-staging invocation', () => {
  assert.deepEqual(childEnvironment({ PATH: '/bin', DATABASE_URL_UNPOOLED: 'secret', PGHOST: 'production', NODE_OPTIONS: '--env-file=.env.local' }), { PATH: '/bin' });
  const valid = { NEON_BRANCH: 'staging', DATABASE_URL_UNPOOLED: 'postgresql://owner:secret@ep-test.eu-west-2.aws.neon.tech/db?channel_binding=require' };
  assert.equal(stagingConnection(valid).searchParams.get('sslmode'), 'verify-full');
  assert.equal(stagingConnection(valid).searchParams.get('channel_binding'), 'require');
  assert.throws(() => stagingConnection({ ...valid, NEON_BRANCH: 'production' }));
  assert.throws(() => stagingConnection({ ...valid, DATABASE_URL_UNPOOLED: valid.DATABASE_URL_UNPOOLED.replace('ep-test.', 'ep-test-pooler.') }));
  for (const args of [[], ['--production'], ['--staging', '--apply']]) {
    const result = spawnSync(process.execPath, ['scripts/neon-runtime-staging-verify.mjs', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /postgres(?:ql)?:\/\/|secret|SQLSTATE/);
  }
});

test('staging migration discovery validates current SQL without transaction escapes', async () => {
  const directory = new URL('../neon/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql'))) {
    validateMigration(await readFile(new URL(file, directory), 'utf8'));
  }
  for (const sql of ['COMMIT;', 'ROLLBACK;', 'BEGIN;', 'START TRANSACTION;', 'PREPARE TRANSACTION x;']) {
    assert.throws(() => validateMigration(sql));
  }
});

test('runtime URL preserves transport requirements without owner startup options', () => {
  const owner = new URL('postgresql://owner:owner-secret@example.invalid/db?sslmode=verify-full&channel_binding=require&options=-crole%3Downer');
  const runtime = runtimeConnection(owner, 'runtime-secret');
  assert.equal(runtime.searchParams.get('sslmode'), 'verify-full');
  assert.equal(runtime.searchParams.get('channel_binding'), 'require');
  assert.equal(runtime.searchParams.has('options'), false);
  assert.equal(runtime.username, 'awalogo_runtime');
  assert.equal(runtime.password, 'runtime-secret');
  assert.equal(owner.username, 'owner');
  assert.equal(owner.password, 'owner-secret');
  assert.equal(runtimeConnection(new URL('postgresql://owner@localhost/db'), 'secret').search, '');
});

test('output accepts only private ignored runtime filenames, never owner paths', () => {
  assert.equal(parseArgs([]).mode, '--plan');
  assert.equal(parseArgs(['--apply']).output, '.env.neon-runtime.local');
  for (const branch of ['staging', 'production']) {
    const output = `.env.neon-${branch}-runtime.local`;
    assert.equal(parseArgs(['--apply', `--output=${output}`]).output, output);
    assert.equal(spawnSync('git', ['check-ignore', '--quiet', output]).status, 0);
  }
  for (const output of ['.env.local', '.env.neon-staging.local', '.env.neon-production.local', '../.env.neon-runtime.local', '/tmp/.env.neon-runtime.local', '.env.neon-runtime.local/child', '']) {
    assert.throws(() => parseArgs(['--apply', `--output=${output}`]));
  }
  assert.throws(() => parseArgs(['--apply', '--output=.env.neon-runtime.local', '--apply']));
  assert.throws(() => parseArgs(['--plan', '--output=.env.neon-runtime.local']));
});

test('plan is offline, secret-free, explicit and non-owner', () => {
  const result = spawnSync(process.execPath, ['scripts/neon-runtime-role.mjs', '--dry-run'], {
    encoding: 'utf8', env: { ...process.env, DATABASE_URL_UNPOOLED: 'invalid-secret' },
  });
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /invalid-secret|PASSWORD|SECURITY DEFINER|ALL TABLES|DEFAULT PRIVILEGES/);
  assert.match(result.stdout, /NOBYPASSRLS NOCREATEDB NOCREATEROLE/);
  assert.doesNotMatch(result.stdout, /GRANT.*awalogo_migrations|ALTER.*OWNER|GRANT.*TO PUBLIC/);
  for (const [table, ops] of Object.entries(grants)) {
    for (const op of ops) assert.ok(plan().some((sql) => sql.includes(`ON public.${table} FOR ${op} TO awalogo_runtime`)));
  }
  assert.equal(functions.length, 4);
  assert.ok(grants.logo_request_budgets.includes('DELETE'));
  assert.ok(grants.logo_request_receipts.includes('UPDATE'));
});

test('password verifier is salted and never contains plaintext', () => {
  const verifier = scramVerifier('not-a-real-password', Buffer.alloc(16));
  assert.match(verifier, /^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  assert.doesNotMatch(verifier, /not-a-real-password/);
  assert.notEqual(scramVerifier('same'), scramVerifier('same'));
});

test('Neon password creation escapes literals without changing role privileges', async () => {
  const statements = [];
  const client = { async query(sql) {
    statements.push(sql);
    if (sql.startsWith('SELECT current_database')) return { rows: [{ database: 'test' }] };
    if (sql.startsWith('CREATE ROLE')) throw new Error('test-stop-before-grants');
    return { rows: [] };
  } };
  await assert.rejects(provision(client, "fixture'password", { neon: true }), /test-stop/);
  const statement = statements.find(sql => sql.startsWith('CREATE ROLE'));
  assert.ok(statement.endsWith("PASSWORD 'fixture''password'"));
  assert.match(statement, /NOBYPASSRLS NOCREATEDB NOCREATEROLE/);
  assert.equal(statements.at(-1), 'ROLLBACK');
});

test('provision failures roll back, existing roles are never altered', async () => {
  const calls = [];
  const client = { async query(sql) {
    calls.push(sql);
    if (sql.startsWith('SELECT current_database')) return { rows: [{ database: 'test"database' }] };
    if (sql.startsWith('CREATE ROLE')) throw new Error('existing role');
    return { rows: [] };
  } };
  await assert.rejects(provision(client, 'secret'));
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.ok(!calls.some((sql) => sql.includes('secret')));
  assert.ok(!calls.includes('COMMIT'));
});

test('effective privilege audit fails closed for PUBLIC leakage and definer functions', async () => {
  await assert.rejects(verify({ query: async () => ({ rows: [{ unsafe: true }] }) }));
  let calls = 0;
  await assert.rejects(verify({ query: async () => ({ rows: ++calls === 1 ? [{ unsafe: false }] : [{ signature: functions[0], prosecdef: true }] }) }));
});

// Explicit opt-in only: never consume DATABASE_URL or DATABASE_URL_UNPOOLED.
const local = process.env.SEC07_TEST_DATABASE_URL;
test('local PostgreSQL: invoker operations and denied DDL/private access', { skip: !local }, async () => {
  const url = new URL(local);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'local database only');
  assert.match(url.pathname, /^\/sec07_test[a-z0-9_]*$/);
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: local });
  await client.connect();
  try {
    await client.query('BEGIN');
    const directory = new URL('../neon/migrations/', import.meta.url);
    for (const name of (await readdir(directory)).filter((f) => f.endsWith('.sql')).sort()) {
      await client.query(await readFile(new URL(name, directory), 'utf8'));
    }
    await client.query('CREATE TABLE public.awalogo_migrations(name text)');
    await client.query('REVOKE ALL ON public.awalogo_migrations FROM PUBLIC');
    await client.query('CREATE SCHEMA sec07_private; CREATE TABLE sec07_private.secret(value text)');
    // provision owns BEGIN, so finish fixture setup inside the same rollback-only transaction
    // by suppressing its nested BEGIN; everything, including role creation, is rolled back.
    await provision({ query: (sql, values) => sql === 'BEGIN' ? Promise.resolve({ rows: [] }) : client.query(sql, values) }, 'test-only');
    await client.query('SET LOCAL ROLE awalogo_runtime');
    const denied = async (sql) => {
      await client.query('SAVEPOINT denial');
      await assert.rejects(client.query(sql), (error) => error.code === '42501');
      await client.query('ROLLBACK TO SAVEPOINT denial');
    };
    for (const sql of [
      'CREATE TABLE public.forbidden(id int)', 'CREATE SCHEMA forbidden',
      'CREATE TEMP TABLE forbidden(id int)', 'CREATE ROLE forbidden',
      'ALTER TABLE public.asset_requests ADD COLUMN forbidden int',
      'SELECT * FROM public.awalogo_migrations', 'SELECT * FROM sec07_private.secret',
      'TRUNCATE public.asset_requests', 'DELETE FROM public.asset_requests',
    ]) await denied(sql);
    await client.query("SELECT public.record_product_event(gen_random_uuid(),'test','','','')");
    await client.query('SELECT public.record_logo_downloads($1,$2)', [['sec07-test'], 'a'.repeat(64)]);
    const id = '00000000-0000-4000-8000-000000000007';
    const claim = await client.query('SELECT public.claim_logo_request($1,$2,$3,$4,$5) AS reply', [id, ...['a','b','c','d'].map((s) => s.repeat(64))]);
    assert.equal(claim.rows[0].reply.kind, 'accepted');
    await client.query('UPDATE public.logo_request_receipts SET reply=$1 WHERE submission_id=$2', [{ ok: true }, id]);
    await client.query(`INSERT INTO public.asset_reports(submission_id,slug,variation,format,reason) VALUES($1,'test','primary','svg','test')`, [id]);
    await client.query('SELECT public.triage_asset_report($1,$2,$3,$4)', [id, 'resolved', 'test resolution', 'tester']);
    await client.query('SELECT * FROM public.product_event_daily');
    await client.query('SELECT * FROM public.logo_download_totals');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
