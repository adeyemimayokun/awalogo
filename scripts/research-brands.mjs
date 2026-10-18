import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";
import sharp from "sharp";
import { discoverBrandArtwork } from "./lib/brand-artwork.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const research = join(root, "packages/brands/research");
const seedFiles = ["candidates.json", "supplemental-candidates.json", "telecom-candidates.json"];
const allSeeds = (await Promise.all(seedFiles.map(async (file) => JSON.parse(await readFile(join(research, file), "utf8"))))).flat();
const seeds = [...new Map(allSeeds.map((entry) => [entry[0].toLowerCase(), entry])).values()];
const overrides = JSON.parse(await readFile(join(research, "source-overrides.json"), "utf8"));
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7).split(",");
const legacy = JSON.parse(await readFile(join(root, "packages/catalog-ui/src/generated/runtime-catalog.json"), "utf8")).items.map((item) => item.logo);
legacy.push(...JSON.parse(await readFile(join(root, "packages/logos/src/promoted-catalog.json"), "utf8")));
const normalize = (name) => name.toLowerCase().replace(/\b(limited|ltd|plc|inc|llc)\b/g, "").replace(/[^a-z0-9]/g, "");
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const manifestPath = join(research, "manifest.json");
const previous = await readFile(manifestPath, "utf8").then(JSON.parse).catch(() => ({ entries: [] }));
const privateIP = (address) => /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd]|fe80)/i.test(address);
async function fetchPublic(input, maxBytes = 2500000, redirects = 0) {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hostname === "localhost" || isIP(url.hostname)) throw new Error("Unsafe source URL");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => privateIP(address))) throw new Error("Unsafe source address");
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(18000), headers: { "User-Agent": "awalogo-brand-research/1.0 (+https://awalogo.com)", Accept: "text/html,image/svg+xml,image/png,image/webp,*/*;q=0.5" } });
  if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
    await response.body?.cancel();
    if (redirects >= 4) throw new Error("Too many redirects");
    return fetchPublic(new URL(response.headers.get("location"), url).href, maxBytes, redirects + 1);
  }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > maxBytes) throw new Error("Source exceeds size limit"); chunks.push(chunk); }
  return { url: url.href, bytes: Buffer.concat(chunks), contentType: response.headers.get("content-type") || "" };
}
await mkdir(join(root, "packages/brands/staging"), { recursive: true });
const queue = [...seeds]; const entries = [];
async function worker() {
  while (queue.length) {
    const [name, industry, target_market, website] = queue.shift();
    const slug = slugify(name);
    const cached = previous.entries.find((item) => item.slug === slug);
    if (cached && (!process.argv.includes("--refresh") || (only && !only.includes(slug)))) { entries.push(cached); continue; }
    const matches = legacy.filter((logo) => [logo.slug, logo.name, ...logo.aliases].some((value) => normalize(value) === normalize(name)));
    const entry = { slug, name, aliases: [], industry, target_market, website, origin_country: null, headquarters_country: null, operating_countries: [], disposition: "unresolved", reason: "Research not completed", duplicate_of: matches[0]?.slug ?? null, sources: [], candidate_assets: [], review_notes: "Country of origin and headquarters require evidence; target market is a campaign assignment, not verified presence." };
    try {
      let page;
      let failure;
      for (const source of [...(overrides[slug]?.pages || []), website]) {
        try { page = await fetchPublic(source, 3000000); break; } catch (error) { failure = error; }
      }
      if (!page) throw failure;
      const $ = load(page.bytes.toString("utf8"));
      const artwork = discoverBrandArtwork($, page.url, name);
      entry.aliases = overrides[slug]?.aliases || [];
      $("script,style,noscript,svg").remove();
      const title = $("title").first().text().trim();
      const description = $("meta[name=description]").attr("content") || "";
      const text = $("body").text().replace(/\s+/g, " ").trim();
      entry.sources.push({ url: page.url, type: "official-website", retrieved_at: "2026-10-18", title, description: description.slice(0, 700), excerpt: text.slice(0, 1800), page_checksum: createHash("sha256").update(page.bytes).digest("hex") });
      if (/just a moment|access denied|attention required|checking your browser/i.test(title) || (text.length < 60 && !artwork.length)) throw new Error("Site returned a challenge or insufficient research content");
      entry.disposition = matches.length ? "duplicate" : "pending-review";
      entry.reason = matches.length ? `Potential match with existing ${matches[0].name}; existing record retained unchanged.` : "Official website retrieved; identity, market evidence, and artwork await manual review.";
      for (const [index, candidate] of artwork.entries()) {
        try {
          const asset = candidate.bytes ? candidate : await fetchPublic(candidate.url, 2000000);
          const metadata = await sharp(asset.bytes).metadata();
          if (!["svg", "png", "webp", "jpeg"].includes(metadata.format) || !metadata.width || !metadata.height || metadata.width < 40 || metadata.height < 12) continue;
          if (metadata.format === "svg" && /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?!#)/i.test(asset.bytes.toString())) continue;
          const checksum = createHash("sha256").update(asset.bytes).digest("hex");
          const path = `staging/${slug}-${index}-${checksum.slice(0, 12)}.${metadata.format}`;
          await writeFile(join(root, "packages/brands", path), asset.bytes);
          entry.candidate_assets.push({ path, source_url: asset.url, discovered_on: page.url, source_type: "official-website", format: metadata.format, width: metadata.width, height: metadata.height, checksum, retrieved_at: "2026-10-18", reviewed: false });
        } catch { /* One broken image must not discard the website research. */ }
      }
    } catch (error) { if (!matches.length) { entry.disposition = "unresolved"; entry.reason = `Website/artwork research incomplete: ${error.message}`; } else { entry.disposition = "duplicate"; entry.reason = `Potential existing identity: ${matches[0].slug}.`; } }
    entries.push(entry); console.log(`${entries.length}/${seeds.length} ${entry.disposition}: ${name} (${entry.candidate_assets.length} staged)`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const ordered = seeds.map(([name]) => entries.find((entry) => entry.slug === slugify(name)));
const counts = ordered.reduce((result, entry) => ({ ...result, [entry.disposition]: (result[entry.disposition] || 0) + 1 }), {});
await writeFile(manifestPath, `${JSON.stringify({ campaign: "africa-100", researched_on: "2026-10-18", policy: "Existing logos immutable; staging is never public; official or manually reviewed community sources only.", summary: counts, entries: ordered }, null, 2)}\n`);
console.log(counts);
