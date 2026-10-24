import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import sharp from "sharp";
import { discoverBrandArtwork } from "./lib/brand-artwork.mjs";
import { identityCollision } from "../packages/brands/identity.mjs";

const seedFile = process.argv.find((arg) => arg.startsWith("--seeds="))?.slice(8) ?? "popular-candidates.json";
if (!["popular-candidates.json","requested-candidates.json","market-candidates.json","disco-candidates.json","hospitality-candidates.json","services-candidates.json"].includes(seedFile)) throw new Error("Unknown research campaign");
const seeds = JSON.parse(await readFile(`packages/brands/research/${seedFile}`, "utf8"));
const only = process.argv.find((arg)=>arg.startsWith("--only="))?.slice(7).split(",");
const manifestPath = "packages/brands/research/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath,"utf8"));
const catalog = JSON.parse(await readFile("packages/brands/catalog.json","utf8"));
const legacy = JSON.parse(await readFile("packages/catalog-ui/src/generated/runtime-catalog.json","utf8")).items.map((item)=>item.logo);
const searchAliases = JSON.parse(await readFile("packages/brands/research/search-aliases.json","utf8"));
const known = legacy.map((item)=>({...item,aliases:[...item.aliases,...(searchAliases[item.slug]?.aliases??[])]}));
const date = "2026-10-19";
const hash = (value) => createHash("sha256").update(value).digest("hex");
function fetchSource(url) {
  if (new URL(url).protocol !== "https:") throw new Error("HTTPS sources required");
  return execFileSync("curl",["--fail","--location","--silent","--show-error","--proto","=https","--proto-redir","=https","--max-redirs","4","--max-time","12","--max-filesize","5000000",url],{ maxBuffer:5000000, stdio:["ignore","pipe","pipe"] });
}
await mkdir("packages/brands/staging",{recursive:true});
for (const [name,industry,target_market,website] of seeds) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,"-");
  if(only && !only.includes(slug)) continue;
  if (catalog.brands.some((item) => item.slug===slug)) continue;
  const entry = { slug,name,aliases:[],industry,target_market,website,origin_country:null,headquarters_country:null,operating_countries:[],disposition:"unresolved",reason:"Awaiting source review",duplicate_of:null,sources:[],candidate_assets:[],review_notes:"Official page retrieval is not artwork approval." };
  const duplicate=identityCollision(entry,known);
  if (duplicate) {
    entry.disposition="duplicate";entry.duplicate_of=duplicate.slug;entry.reason=`Already available as ${duplicate.slug}; do not replace its existing assets.`;
    const index=manifest.entries.findIndex((item)=>item.slug===slug);
    if(index<0) manifest.entries.push(entry);else manifest.entries[index]=entry;
    console.log(`${slug}: existing identity ${duplicate.slug}`);
    continue;
  }
  try {
    const page = fetchSource(website);
    const $ = load(page.toString());
    const title = $("title").text();
    entry.sources.push({ url:website,type:"official-website",retrieved_at:date,title,page_checksum:hash(page) });
    const artwork = discoverBrandArtwork($,website,name).slice(0,2);
    for (const [index,candidate] of artwork.entries()) {
      try {
        const bytes = candidate.bytes ?? fetchSource(candidate.url);
        const meta = await sharp(bytes).metadata();
        if (!["svg","png","webp","jpeg"].includes(meta.format) || meta.width<40 || meta.height<12) continue;
        const checksum=hash(bytes), path=`staging/${slug}-popular-${index}-${checksum.slice(0,12)}.${meta.format}`;
        await writeFile(`packages/brands/${path}`,bytes);
        entry.candidate_assets.push({ path,source_url:candidate.url,discovered_on:website,source_type:"official-website",format:meta.format,width:meta.width,height:meta.height,checksum,retrieved_at:date,reviewed:false });
      } catch { /* Retain other candidates when an image is unavailable. */ }
    }
    entry.disposition = entry.candidate_assets.length ? "pending-review" : "unresolved";
    entry.reason = entry.candidate_assets.length ? "Official artwork staged; identity and visual review required." : "Official site retrieved but no usable logo discovered. Do not substitute product or partner artwork.";
  } catch (error) { entry.reason=`Official source unavailable: ${error.message.slice(0,180)}`; }
  const index = manifest.entries.findIndex((item) => item.slug===slug);
  if (index<0) manifest.entries.push(entry); else manifest.entries[index]=entry;
  console.log(`${slug}: ${entry.disposition}, ${entry.candidate_assets.length} candidates`);
}
manifest.summary = manifest.entries.reduce((result,entry) => { result[entry.disposition]=(result[entry.disposition]??0)+1;return result; },{});
await writeFile(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
