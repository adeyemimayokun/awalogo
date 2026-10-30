import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

try { process.loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!process.env.DATABASE_URL_UNPOOLED) throw new Error('DATABASE_URL_UNPOOLED is required for migrations');
const connection = new URL(process.env.DATABASE_URL_UNPOOLED);
if (connection.searchParams.get('sslmode') === 'require') connection.searchParams.set('sslmode', 'verify-full');
const client = new pg.Client({ connectionString: connection.toString(), connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('awalogo-migrations'))");
  await client.query('CREATE TABLE IF NOT EXISTS public.awalogo_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  await client.query('REVOKE ALL ON public.awalogo_migrations FROM PUBLIC');
  const directory = fileURLToPath(new URL('../neon/migrations/', import.meta.url));
  for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = await readFile(`${directory}/${name}`, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const { rows } = await client.query('SELECT checksum FROM public.awalogo_migrations WHERE name=$1', [name]);
    if (rows.length) {
      if (rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
      console.log(`Already applied: ${name}`);
      continue;
    }
    await client.query(sql);
    await client.query('INSERT INTO public.awalogo_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
    console.log(`Applied: ${name}`);
  }
  await client.query('COMMIT');
  console.log('Neon migrations committed successfully');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(`Migration failed (${error.code ?? error.name}); transaction rolled back`);
  process.exitCode = 1;
} finally { await client.end(); }
