import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "packages/brands/legacy-baseline.json");
const protectedPaths = ["packages/logos/src", "packages/institutions/src", "packages/institutions/data", "packages/institutions/exports", "packages/catalog-ui/src/generated/runtime-catalog.json", "apps/web/public/catalog/v1"];
async function hashes() {
  const result = {};
  async function visit(path) {
    const absolute = join(root, path);
    const entries = await readdir(absolute, { withFileTypes: true }).catch((error) => error.code === "ENOTDIR" ? null : Promise.reject(error));
    if (entries) { for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) await visit(join(path, entry.name)); }
    else result[relative(root, absolute)] = createHash("sha256").update(await readFile(absolute)).digest("hex");
  }
  for (const path of protectedPaths) await visit(path);
  return result;
}
const current = await hashes();
if (process.argv.includes("--capture")) {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify({ captured_on: "2026-10-18", files: current }, null, 2)}\n`, { flag: "wx" });
  console.log(`Captured ${Object.keys(current).length} protected legacy files. Baseline cannot be overwritten.`);
} else {
  const baseline = JSON.parse(await readFile(target, "utf8"));
  const changed = [...new Set([...Object.keys(current), ...Object.keys(baseline.files)])].filter((path) => current[path] !== baseline.files[path]);
  if (changed.length) throw new Error(`Existing logo/institution/catalog files changed:\n${changed.join("\n")}`);
  console.log(`Legacy baseline intact: ${Object.keys(current).length} files unchanged.`);
}
