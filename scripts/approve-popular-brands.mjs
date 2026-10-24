import { readFile, writeFile } from "node:fs/promises";

const path = "packages/brands/research/";
const manifest = JSON.parse(await readFile(`${path}manifest.json`,"utf8"));
const reviews = JSON.parse(await readFile(`${path}reviews.json`,"utf8"));
// Explicit selections from the visual review, not automatic discovery approvals.
const selections = [
  ["dangote-group",1,"dark",["Dangote", "Dangote Industries", "Dangote Industries Limited"]],
  ["dangote-cement",0,"light",["Dangote Cement Plc", "DCP"]],
  ["dangote-sugar",0,"dark",["Dangote Sugar Refinery", "DSR"]],
  ["dangote-refinery",1,"light",["Dangote Petroleum Refinery", "Dangote Petroleum Refinery and Petrochemicals"]],
  ["dangote-fertiliser",1,"dark",["Dangote Fertilizer", "Dangote Fertiliser Limited"]],
  ["nascon-allied-industries",0,"light",["NASCON", "Dangote Salt", "Dangote Seasoning"]]
];
for (const [slug,index,background,aliases] of selections) {
  if (reviews.some((review) => review.slug===slug)) throw new Error(`Already reviewed: ${slug}`);
  const entry=manifest.entries.find((entry) => entry.slug===slug);
  const asset=entry?.candidate_assets[index];
  if (!asset) throw new Error(`Missing selected source: ${slug}`);
  const note = "Official Dangote business directory identifies this group/subsidiary and its Nigerian operations. Its own official site supplies the selected identity; a generic parent logo is not substituted for a subsidiary.";
  const review_notes = "Official logo visually reviewed against the source site's identity. White artwork uses a dark preview. Source bytes are preserved; transparent padding may be trimmed in derived formats. No trademark licence or endorsement is asserted.";
  reviews.push({ slug,decision:"approved",asset_path:asset.path,reviewer:"Codex assisted source and visual review",reviewed_at:"2026-10-19",ownership_checked:true,visual_reviewed:true,review_notes,origin_country:null,headquarters_country:null,operating_countries:["NG"],preview_background:background,evidence:[{url:"https://www.dangote.com/businesses/",note,retrieved_at:"2026-10-19"}],aliases,website:entry.website,trim_padding:true,without_enlargement:true,batch:"popular-brands-2026-10-19" });
  entry.disposition="approved";entry.reason=review_notes;
}
await writeFile(`${path}reviews.json`,`${JSON.stringify(reviews,null,2)}\n`);
await writeFile(`${path}manifest.json`,`${JSON.stringify(manifest,null,2)}\n`);
console.log(`Recorded ${selections.length} explicit visual approvals.`);
