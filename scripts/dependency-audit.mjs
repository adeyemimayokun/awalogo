import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const exceptions = JSON.parse(readFileSync(new URL("dependency-audit-exceptions.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
const input = args.indexOf("--input");
const output = args.indexOf("--output");
let report;
if (input >= 0) {
  report = JSON.parse(readFileSync(args[input + 1], "utf8"));
} else {
  const cli = process.env.npm_execpath;
  const command = cli ? process.execPath : "pnpm";
  const result = spawnSync(command, [...(cli ? [cli] : []), "audit", "--json"], {
    cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 20 * 1024 * 1024
  });
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`Dependency audit unavailable: ${result.error?.message || result.stderr || result.stdout}`);
  }
  report = JSON.parse(result.stdout);
}
if (!report.advisories || !report.metadata?.vulnerabilities || report.error) {
  throw new Error("Invalid npm advisory response; refusing to pass without audit data");
}
if (output >= 0) writeFileSync(args[output + 1], `${JSON.stringify(report, null, 2)}\n`);

const now = Date.now();
for (const exception of exceptions) {
  if (!exception.reason || !exception.reference || !exception.paths?.length || !exception.advisories?.length ||
      !exception.versions?.length || !Number.isFinite(Date.parse(exception.expires)) || Date.parse(exception.expires) <= now) {
    throw new Error(`Invalid or expired dependency exception: ${exception.module}`);
  }
}
let blocked = 0;
let accepted = 0;
for (const advisory of Object.values(report.advisories)) {
  if (!advisory.findings?.length) throw new Error(`Missing paths for ${advisory.github_advisory_id}`);
  for (const finding of advisory.findings) {
    if (!finding.paths?.length) throw new Error(`Missing dependency path for ${advisory.github_advisory_id}`);
    for (const path of finding.paths) {
      const exception = advisory.severity !== "critical" && exceptions.find((entry) =>
        entry.module === advisory.module_name && entry.advisories.includes(advisory.github_advisory_id) &&
        entry.versions.includes(finding.version) && entry.paths.includes(path));
      if (exception) {
        accepted++;
        console.log(`EXCEPTION ${advisory.github_advisory_id} ${path}@${finding.version} (expires ${exception.expires})`);
      } else {
        blocked++;
        console.error(`BLOCKED ${advisory.severity} ${advisory.github_advisory_id} ${path}@${finding.version}; patched: ${advisory.patched_versions || "none"}`);
      }
    }
  }
}
console.log(JSON.stringify({ vulnerabilities: report.metadata.vulnerabilities, acceptedPaths: accepted, blockedPaths: blocked }));
process.exitCode = blocked ? 1 : 0;
