import { readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOBBY_FUNCTION_LIMIT = 12;
const FUNCTION_EXTENSIONS = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const apiDirectory = resolve(repositoryRoot, "api");

async function collectFunctionEntrypoints(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const functions = [];

  for (const entry of entries) {
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;

    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      functions.push(...await collectFunctionEntrypoints(entryPath));
      continue;
    }

    if (entry.name.endsWith(".d.ts") || !FUNCTION_EXTENSIONS.has(extname(entry.name))) continue;
    functions.push(relative(repositoryRoot, entryPath));
  }

  return functions;
}

const functions = (await collectFunctionEntrypoints(apiDirectory)).sort();

console.log(`Vercel function entrypoints: ${functions.length}/${HOBBY_FUNCTION_LIMIT}`);
for (const functionPath of functions) console.log(`- ${functionPath}`);

if (functions.length > HOBBY_FUNCTION_LIMIT) {
  console.error(
    `Hobby deployments support at most ${HOBBY_FUNCTION_LIMIT} functions. ` +
    "Consolidate routes or prefix non-function files with an underscore."
  );
  process.exitCode = 1;
}
