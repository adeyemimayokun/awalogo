import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Exercise emitted CommonJS with require(ESM) disabled, as in Vercel's loader.
test('compiled mutation handler loads and rejects unsafe requests before side effects', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const cache = join(root, 'node_modules/.cache');
  await mkdir(cache, { recursive: true });
  const output = await mkdtemp(join(cache, 'admin-runtime-'));
  try {
    execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'api/tsconfig.json',
      '--noEmit', 'false', '--composite', 'false', '--incremental', 'false', '--rootDir', '.', '--outDir', output], { cwd: root, stdio: 'pipe' });
    for (const path of ['packages/validator/svg-security.mjs', 'packages/brands/render-cache.mjs', 'packages/brands/published-render-baseline.mjs']) {
      await mkdir(join(output, path, '..'), { recursive: true });
      await cp(join(root, path), join(output, path));
    }
    const probe = `
      const assert=require('node:assert/strict');
      const handler=require(${JSON.stringify(join(output, 'api/admin/mutate.js'))}).default;
      const {safeArtwork}=require(${JSON.stringify(join(output, 'api/_lib/admin-resource-mutations.js'))});
      const response=()=>({code:0,status(n){this.code=n;return this},setHeader(){},json(){}});
      (async()=>{
        for(const [method,origin,expected] of [['GET',undefined,405],['POST','https://evil.invalid',403],['POST','https://www.awalogo.com',401]]){
          const res=response(); await handler({method,headers:{host:'www.awalogo.com',origin},query:{},body:{}},res); assert.equal(res.code,expected);
        }
        const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>');
        assert.deepEqual(await safeArtwork({type:'svg',base64:svg.toString('base64')}),svg);
        await assert.rejects(safeArtwork({type:'svg',base64:Buffer.from('<svg><script/></svg>').toString('base64')}));
      })().catch(e=>{console.error(e);process.exitCode=1});`;
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--no-experimental-require-module', '-e', probe], {
      cwd: root, stdio: 'pipe', env: { PATH: process.env.PATH, VERCEL: '1' },
    }));
  } finally { await rm(output, { recursive: true, force: true }); }
});
