import { randomBytes, pbkdf2Sync, createHmac, createHash } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const role = 'awalogo_runtime';
export const grants = {
  asset_requests: ['SELECT', 'INSERT', 'UPDATE'],
  asset_reports: ['SELECT', 'INSERT', 'UPDATE'],
  admin_plugin_snapshots: ['SELECT', 'INSERT'],
  admin_report_audit: ['INSERT'],
  product_event_daily: ['SELECT', 'INSERT', 'UPDATE'],
  product_event_receipts: ['SELECT', 'INSERT', 'DELETE'],
  logo_download_totals: ['SELECT', 'INSERT', 'UPDATE'],
  logo_download_daily: ['SELECT', 'INSERT', 'DELETE'],
  logo_request_budgets: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  logo_request_receipts: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
};
export const functions = [
  'record_product_event(uuid,text,text,text,text)',
  'triage_asset_report(uuid,text,text,text)',
  'record_logo_downloads(text[],text)',
  'claim_logo_request(uuid,text,text,text,text)',
];
const updateColumns = {
  asset_requests: 'status, updated_at',
  asset_reports: 'status, resolution_note, updated_by, updated_at',
  product_event_daily: 'count',
  logo_download_totals: 'downloads',
  logo_request_budgets: 'count',
  logo_request_receipts: 'reply',
};
const ident = (s) => `"${s.replaceAll('"', '""')}"`;

// Send only a SCRAM verifier, not the generated plaintext password, in SQL.
export function scramVerifier(password, salt = randomBytes(16)) {
  const salted = pbkdf2Sync(password, salt, 4096, 32, 'sha256');
  const client = createHmac('sha256', salted).update('Client Key').digest();
  const stored = createHash('sha256').update(client).digest('base64');
  const server = createHmac('sha256', salted).update('Server Key').digest('base64');
  return `SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
}

export function plan(database = '<current database>') {
  const sql = [
    `CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT`,
    `REVOKE CREATE, TEMPORARY ON DATABASE ${ident(database)} FROM PUBLIC`,
    'REVOKE CREATE ON SCHEMA public FROM PUBLIC',
    `GRANT CONNECT ON DATABASE ${ident(database)} TO ${role}`,
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    `ALTER ROLE ${role} SET search_path = pg_catalog, public`,
  ];
  for (const [table, ops] of Object.entries(grants)) {
    sql.push(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    const privileges = ops.map((op) => op === 'UPDATE' ? `UPDATE (${updateColumns[table]})` : op);
    sql.push(`GRANT ${privileges.join(', ')} ON public.${table} TO ${role}`);
    for (const op of ops) {
      const using = op === 'INSERT' ? '' : ' USING (true)';
      const check = ['INSERT', 'UPDATE'].includes(op) ? ' WITH CHECK (true)' : '';
      sql.push(`CREATE POLICY runtime_${op.toLowerCase()} ON public.${table} FOR ${op} TO ${role}${using}${check}`);
    }
  }
  for (const fn of functions) sql.push(`GRANT EXECUTE ON FUNCTION public.${fn} TO ${role}`);
  return sql;
}

// Effective privileges include PUBLIC. Never silently broaden unrelated schema ACLs.
export async function verify(client) {
  const { rows } = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_roles WHERE rolname=$1 AND
        (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication OR rolinherit)
      UNION ALL SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1
      UNION ALL SELECT 1 FROM pg_database WHERE datname=current_database() AND
        (has_database_privilege($1,oid,'CREATE') OR has_database_privilege($1,oid,'TEMP'))
      UNION ALL SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema' AND
        (has_schema_privilege($1,oid,'CREATE') OR (nspname <> 'public' AND has_schema_privilege($1,oid,'USAGE')))
      UNION ALL SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','f','S') AND
        (c.relowner=(SELECT oid FROM pg_roles WHERE rolname=$1) OR
         (NOT (n.nspname='public' AND c.relname=ANY($2::text[])) AND
          CASE WHEN c.relkind='S' THEN has_sequence_privilege($1,c.oid,'USAGE,SELECT,UPDATE')
          ELSE has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            OR EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
              AND has_column_privilege($1,c.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')) END))
    ) AS unsafe`, [role, Object.keys(grants)]);
  if (rows[0]?.unsafe !== false) throw new Error('Unsafe effective runtime privileges');
  const result = await client.query(`SELECT p.oid::regprocedure::text AS signature, p.prosecdef
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
      AND has_function_privilege($1,p.oid,'EXECUTE')`, [role]);
  if (result.rows.some((r) => r.prosecdef || !functions.includes(r.signature.replace(/^public\./, '')))) {
    throw new Error('Unexpected executable application function');
  }
}

export async function provision(client, password, { neon = false } = {}) {
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('awalogo-migrations'))");
    const { rows } = await client.query('SELECT current_database() AS database');
    // CREATE (not ALTER) deliberately refuses existing roles, including owners.
    const statements = plan(rows[0].database);
    // Neon's control plane requires the original password over verified TLS.
    // PostgreSQL handles encryption at rest; never print this statement.
    const credential = neon ? password.replaceAll("'", "''") : scramVerifier(password);
    await client.query("SET LOCAL standard_conforming_strings=on");
    await client.query(`${statements.shift()} PASSWORD '${credential}'`);
    for (const sql of statements) await client.query(sql);
    await verify(client);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export function parseArgs(args) {
  const mode = args[0] ?? '--plan';
  if (!['--plan', '--dry-run', '--apply'].includes(mode)) throw new Error('Invalid mode');
  const output = args[1]?.startsWith('--output=') ? args[1].slice('--output='.length) : '.env.neon-runtime.local';
  if (args.length > 2 || (args.length === 2 && !args[1].startsWith('--output=')) ||
      (args.length === 2 && mode !== '--apply') ||
      !['.env.neon-runtime.local', '.env.neon-staging-runtime.local', '.env.neon-production-runtime.local'].includes(output)) {
    throw new Error('Use --apply with an optional approved runtime env filename');
  }
  return { mode, output };
}

export function runtimeConnection(connection, password) {
  const runtime = new URL(connection);
  runtime.username = role;
  runtime.password = password;
  // Preserve transport requirements, never owner-specific startup options.
  runtime.search = '';
  for (const key of ['sslmode', 'channel_binding']) {
    if (connection.searchParams.has(key)) runtime.searchParams.set(key, connection.searchParams.get(key));
  }
  return runtime;
}

export async function main(args = process.argv.slice(2)) {
  const { mode, output: file } = parseArgs(args);
  if (mode !== '--apply') {
    console.log(`${plan().join(';\n')};\n-- Password omitted. No connection or file writes.`);
    return;
  }
  const connection = new URL(process.env.DATABASE_URL_UNPOOLED ?? '');
  if (!['postgres:', 'postgresql:'].includes(connection.protocol) || connection.hostname.includes('-pooler')) {
    throw new Error('Direct DATABASE_URL_UNPOOLED required');
  }
  connection.searchParams.set('sslmode', 'verify-full');
  const password = randomBytes(32).toString('base64url');
  const runtime = runtimeConnection(connection, password);
  // Exclusive creation refuses overwrites/symlinks; reserve before any DB mutation.
  const handle = await open(file, 'wx', 0o600);
  let client;
  let committed = false;
  try {
    const { default: pg } = await import('pg');
    client = new pg.Client({ connectionString: connection.toString(), connectionTimeoutMillis: 15000 });
    await client.connect();
    await provision(client, password, { neon: connection.hostname.endsWith('.neon.tech') });
    await handle.writeFile(`DATABASE_URL=${runtime.toString()}\n`);
    await handle.sync();
    await client.query('COMMIT');
    committed = true;
    console.log(`Runtime role provisioned; credentials saved to ignored ${file} (0600).`);
  } finally {
    if (!committed) await client?.query('ROLLBACK').catch(() => {});
    await client?.end();
    await handle.close();
    if (!committed) await unlink(file);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Runtime provisioning failed; credentials and database details suppressed.'); process.exitCode = 1; });
}
