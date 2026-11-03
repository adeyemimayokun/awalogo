import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("dependency-audit.mjs", import.meta.url));
function check(report) {
  const dir = mkdtempSync(join(tmpdir(), "awalogo-dependency-audit-"));
  try {
    const path = join(dir, "audit.json");
    writeFileSync(path, JSON.stringify(report));
    return spawnSync(process.execPath, [script, "--input", path], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const base = { advisories: {}, metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 } } };
function report({ severity = "high", path = ".>@vercel/node>undici", version = "5.29.0", id = "GHSA-g9mf-h72j-4rw9" } = {}) {
  return { ...base, advisories: { example: {
    module_name: "undici", github_advisory_id: id, severity,
    findings: [{ version, paths: [path] }]
  } } };
}
test("clean advisory report passes; missing audit data fails closed", () => {
  assert.equal(check(base).status, 0);
  assert.notEqual(check({}).status, 0);
});
test("removed SDK advisories have no remaining exception", () => {
  const result = check(report());
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /BLOCKED/);
});
test("new advisories, versions and runtime paths cannot inherit an exception", () => {
  for (const input of [{ id: "GHSA-new-issue" }, { version: "5.30.0" }, { path: ".>undici" }]) {
    assert.equal(check(report(input)).status, 1);
  }
});
test("critical findings cannot be exempted", () => {
  assert.equal(check(report({ severity: "critical" })).status, 1);
});
