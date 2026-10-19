import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import sharp from "sharp";

const slug = process.argv[2];
const manifestPath = "packages/brands/research/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sourceType = process.argv.includes("--community") ? "community-catalog" : "official-website";
const entry = manifest.entries.find((item) => item.slug === slug);
if (!entry) throw new Error("Unknown candidate");
const pageUrl = process.argv.find((arg) => arg.startsWith("--page="))?.slice(7) ?? entry.website;
function fetch(url) {
  if (new URL(url).protocol !== "https:") throw new Error("HTTPS required");
  return execFileSync("curl", ["-fsSL", "--proto", "=https", "--proto-redir", "=https", "--max-time", "20", "--max-filesize", "8000000", url], { maxBuffer: 8000000 });
}
const localPage = process.argv.find((arg) => arg.startsWith("--local="))?.slice(8);
const page = localPage ? await readFile(localPage) : fetch(pageUrl), $ = load(page.toString());
await writeFile(`/tmp/services-${slug}.html`, page);
if (process.argv.includes("--inspect")) {
  console.log($("title").text());
  console.log($("img").map((_, element) => element.attribs).get().filter((item) => /logo|brand/i.test(JSON.stringify(item))).slice(0, 8));
  console.log($("svg").map((index, element) => ({ index, parent: $(element).parent().prop("outerHTML").slice(0, 220) })).get().slice(0, 5));
  console.log($("script[src]").map((_, element) => $(element).attr("src")).get().slice(-5));
  process.exit(0);
}
const selector = process.argv.find((arg) => arg.startsWith("--svg="))?.slice(6);
const imageSelector = process.argv.find((arg) => arg.startsWith("--image="))?.slice(8);
if (imageSelector && $(imageSelector).length !== 1) throw new Error("Expected exactly one selected image");
const selectedImage = imageSelector ? $(imageSelector).attr("src") ?? $(imageSelector).attr("content") : null;
const artwork = process.argv.find((arg) => arg.startsWith("--asset="))?.slice(8) ?? (selectedImage ? new URL(selectedImage, pageUrl).href : null);
const embedded = process.argv.find((arg) => arg.startsWith("--embedded="))?.slice(11);
const svg = selector ? $(selector) : null;
if (selector && svg.length !== 1) throw new Error("SVG selector must identify exactly one reviewed logo");
const embeddedValue = embedded ? $(embedded).attr("href") : null;
if (embedded && (!embeddedValue?.startsWith("data:image/png;base64,") || $(embedded).length !== 1)) throw new Error("Expected exactly one original embedded PNG");
const bytes = embedded ? Buffer.from(embeddedValue.split(",")[1], "base64") : svg ? Buffer.from($.html(svg.attr("xmlns", "http://www.w3.org/2000/svg"))) : fetch(artwork);
const meta = await sharp(bytes).metadata();
if (!["svg", "png", "webp", "jpeg"].includes(meta.format)) throw new Error("Unsupported artwork");
const checksum = createHash("sha256").update(bytes).digest("hex"), path = `staging/${slug}-reviewed-${checksum.slice(0,12)}.${meta.format}`;
await writeFile(`packages/brands/${path}`, bytes);
entry.candidate_assets.push({ path, source_url: artwork ?? `${pageUrl}#reviewed-inline-logo`, discovered_on: pageUrl, source_type: sourceType, format: meta.format, width: meta.width, height: meta.height, checksum, retrieved_at: "2026-10-19", reviewed: false });
entry.sources.push({ url: pageUrl, type: sourceType, retrieved_at: "2026-10-19", title: $("title").text(), page_checksum: createHash("sha256").update(page).digest("hex") });
entry.disposition = "pending-review";
entry.reason = `Additional ${sourceType} artwork staged; visual review required.`;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${slug}: added candidate ${entry.candidate_assets.length - 1}`);
