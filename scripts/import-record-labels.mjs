import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

// Imports only the source files visually reviewed for this expansion batch.
const directory = "packages/brands/research/";
const manifest = JSON.parse(await readFile(`${directory}manifest.json`, "utf8"));
const reviews = JSON.parse(await readFile(`${directory}reviews.json`, "utf8"));
const date = "2026-10-19";
const sources = [
  { slug:"mavin-records", name:"Mavin Records", aliases:["Mavin", "Mavins", "Mavin Global"], website:"https://www.mavinrecords.com/", page:"https://www.mavinrecords.com/", file:"packages/brands/staging/mavin-records-0-4208b97c83e9.png", artwork:"https://www.mavinrecords.com/wp-content/uploads/2021/04/Mavin-Logo.png", evidence:"https://www.mavinrecords.com/about/", note:"Official record-label website and About page identify Mavin's African entertainment business; Nigerian operations represented by its Lagos contact details.", background:"dark" },
  { slug:"chocolate-city", name:"Chocolate City", aliases:["Chocolate City Music", "CCM"], website:"https://chocolatecitymusic.com/", page:"https://chocolatecitymusic.com/", file:"/tmp/chocolate-city.svg", artwork:"https://chocolatecitymusic.com/wp-content/uploads/2026/02/Asset-2.svg", evidence:"https://chocolatecitymusic.com/about-us/", note:"Official About page identifies Chocolate City Music as a Nigerian record label founded in 2005.", background:"dark" },
  { slug:"dapper-music", name:"Dapper Music", aliases:["Dapper Music Entertainment", "Dapper Music and Entertainment"], website:"https://dappermusicent.com/", page:"https://dappermusicent.com/", file:"/tmp/dapper-logo.png", artwork:"https://dappermusicent.com/logo.png", evidence:"https://dappermusicent.com/about", note:"Official About page describes the group's Nigerian entertainment and record-label operations. Logo URL is declared in the official homepage Organization structured data.", background:"dark" },
  { slug:"ybnl-nation", name:"YBNL Nation", aliases:["YBNL", "YBNL Records"], website:"https://en.wikipedia.org/wiki/YBNL", page:"https://en.wikipedia.org/wiki/YBNL", file:"/tmp/ybnl-logo.jpeg", artwork:"https://thumb.wikimedia.org/wikipedia/en/thumb/6/64/YBNL_logo.jpeg/250px-YBNL_logo.jpeg", evidence:"https://en.wikipedia.org/wiki/YBNL", note:"Community encyclopedia identifies YBNL Nation as Olamide's Nigerian record label. Artwork is community-hosted, manually reviewed and not officially verified; no redistribution licence or affiliation is asserted.", background:"light", community:true }
];
for (const item of sources) {
  if (reviews.some((review) => review.slug === item.slug)) throw new Error(`Already reviewed: ${item.slug}`);
  const bytes = await readFile(item.file);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const metadata = await sharp(bytes).metadata();
  const path = `staging/${item.slug}-music-${checksum.slice(0,12)}.${metadata.format}`;
  await copyFile(item.file, `packages/brands/${path}`);
  const sourceType = item.community ? "community-catalog" : "official-website";
  const asset = { path, source_url:item.artwork, discovered_on:item.page, source_type:sourceType, format:metadata.format, width:metadata.width, height:metadata.height, checksum, retrieved_at:date, reviewed:true };
  let entry = manifest.entries.find((entry) => entry.slug === item.slug);
  if (!entry) { entry = { slug:item.slug, name:item.name, industry:"media-entertainment", target_market:"NG", duplicate_of:null, sources:[], candidate_assets:[] }; manifest.entries.push(entry); }
  Object.assign(entry, { aliases:item.aliases, website:item.website, origin_country:null, headquarters_country:null, operating_countries:["NG"], disposition:"approved", reason:item.note, review_notes:item.note });
  entry.sources = [{ url:item.evidence, type:sourceType, retrieved_at:date, title:item.name, excerpt:item.note }];
  entry.candidate_assets = [asset];
  reviews.push({ slug:item.slug, decision:"approved", asset_path:path, reviewer:"Codex assisted source and visual review", reviewed_at:date, ownership_checked:true, visual_reviewed:true, review_notes:`${item.note} Artwork visually inspected; original raster retained without vector tracing or upscaling. Trademarks remain with their owners.`, origin_country:item.slug === "chocolate-city" ? "NG" : null, headquarters_country:null, operating_countries:["NG"], preview_background:item.background, evidence:[{ url:item.evidence, note:item.note, retrieved_at:date }], aliases:item.aliases, website:item.website, source_type:sourceType, status:item.community ? "needs-review" : "verified", without_enlargement:true, batch:"record-labels-2026-10-19" });
}
manifest.summary = manifest.entries.reduce((result,entry) => { result[entry.disposition]=(result[entry.disposition]??0)+1; return result; },{});
await writeFile(`${directory}manifest.json`, `${JSON.stringify(manifest,null,2)}\n`);
await writeFile(`${directory}reviews.json`, `${JSON.stringify(reviews,null,2)}\n`);
console.log("Imported four reviewed record labels; existing approvals unchanged.");
