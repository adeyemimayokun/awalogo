import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const directory="packages/brands/research/";
const manifest=JSON.parse(await readFile(`${directory}manifest.json`,"utf8"));
const reviews=JSON.parse(await readFile(`${directory}reviews.json`,"utf8"));
const date="2026-10-19";
const filing="https://doclib.ngxgroup.com/Financial_NewsDocs/47232_ARADEL_HOLDINGS_PLC-CORPORATE_ACTION_ANNOUNCEMENT___CORPORATE_ACTIONS_JUNE_2026.pdf";
const selected=[
  {slug:"nairametrics",index:0,aliases:[],evidence:"https://nairametrics.com/about-nairametrics/",note:"Official About page identifies the Nigerian financial and business media operation."},
  {slug:"careerbuddy",index:0,aliases:["Career Buddy"],evidence:"https://thecareerbuddy.com/about",note:"Official About page identifies Lagos headquarters and Nigerian recruitment operations."},
  {slug:"andela",index:1,aliases:[],evidence:"https://www.andela.com/about",note:"Official About page identifies the initial Lagos recruitment and African talent operations. The selected embedded header SVG is Andela, not a testimonial or customer logo."},
  {slug:"techcabal",index:0,aliases:["Tech Cabal"],evidence:"https://techcabal.com/about/",note:"Official publication and About page establish African technology reporting and Nigerian coverage."},
  {slug:"arnergy",index:0,aliases:["Arnergy Solar"],evidence:"https://shop.arnergy.com/policies/shipping-policy",note:"Official shipping policy identifies Arnergy as a Nigerian enterprise serving Nigeria."},
  {slug:"omniretail",index:0,aliases:["OmniRetail Africa"],evidence:"https://www.omniretail.africa/",note:"Official homepage supplies the Omni identity and lists its Lagos operations; not confused with unrelated companies using Omni."},
  {slug:"utiva",file:"/tmp/utiva-logo.svg",artwork:"https://www.utiva.co/static/media/utivacolored.7364336b.svg",page:"https://www.utiva.co/",aliases:[],evidence:"https://utiva.co/contact-us/",note:"Official contact page states Transforming lives from Lagos, Nigeria. The official header image lacks a logo filename and was missed by discovery."},
  {slug:"the-unflux",file:"/tmp/unflux-logo.svg",artwork:"https://www.theunflux.com/assets/svg/icons.svg#logo",page:"https://www.theunflux.com/",aliases:["Unflux"],evidence:"https://www.theunflux.com/about/",note:"User-confirmed identity. Official site describes African product-design education and names its chief facilitator; the facilitator's linked self-authored profile identifies The Unflux project and Lagos. Origin and headquarters remain unconfirmed. The exact logo symbol is extracted as a self-contained SVG, preserving path data and opacity; partner marks are excluded.",extraEvidence:{url:"https://ng.linkedin.com/in/nnamdi-awili-designer",note:"Profile linked from the official About page identifies the facilitator's Unflux project and Lagos location; not treated as proof of incorporation or headquarters.",retrieved_at:date}},
  {slug:"aradel-holdings",file:"/tmp/aradel-logo.png",artwork:filing,page:filing,sourceType:"verified-pdf",aliases:["Aradel", "Niger Delta Exploration and Production", "NDEP"],evidence:filing,note:"Company-issued Aradel Holdings corporate-action filing on NGX provides its current header logo and Lagos address. The header identity was rasterized and isolated from page 1 without tracing or upscaling; the website returned HTTP 403."}
];
await mkdir(`${directory}evidence`,{recursive:true});
const pdf=await readFile("/tmp/aradel-official.pdf");
const pdfHash=createHash("sha256").update(pdf).digest("hex");
await writeFile(`${directory}evidence/${pdfHash}.pdf`,pdf);
for (const item of selected) {
  if (reviews.some((review) => review.slug===item.slug)) throw new Error(`Already reviewed: ${item.slug}`);
  const entry=manifest.entries.find((entry) => entry.slug===item.slug);
  if (!entry) throw new Error(`Missing candidate: ${item.slug}`);
  let asset=entry.candidate_assets[item.index ?? 0];
  if (item.file) {
    const bytes=await readFile(item.file), meta=await sharp(bytes).metadata();
    const checksum=createHash("sha256").update(bytes).digest("hex");
    const path=`staging/${item.slug}-reviewed-${checksum.slice(0,12)}.${meta.format}`;
    await copyFile(item.file,`packages/brands/${path}`);
    asset={path,source_url:item.artwork,discovered_on:item.page,source_type:item.sourceType??"official-website",format:meta.format,width:meta.width,height:meta.height,checksum,retrieved_at:date,reviewed:true};
    entry.candidate_assets.push(asset);
  }
  if (!asset) throw new Error(`No reviewed artwork: ${item.slug}`);
  const evidence=[{url:item.evidence,note:item.note,retrieved_at:date},...(item.extraEvidence?[item.extraEvidence]:[])];
  const review_notes=`${item.note} Artwork visually checked on light and dark backgrounds. Source provenance does not grant a trademark licence or imply endorsement.`;
  reviews.push({slug:item.slug,decision:"approved",asset_path:asset.path,reviewer:"Codex assisted source and visual review",reviewed_at:date,ownership_checked:true,visual_reviewed:true,review_notes,origin_country:null,headquarters_country:null,operating_countries:["NG"],preview_background:"light",evidence,aliases:item.aliases,source_type:item.sourceType??"official-website",without_enlargement:true,trim_padding:asset.format!=="svg",batch:"requested-and-market-2026-10-19"});
  entry.disposition="approved";entry.reason=review_notes;
  entry.sources.push({url:item.evidence,type:item.sourceType??"official-website",retrieved_at:date,title:entry.name,excerpt:item.note});
}
for (const [slug,duplicate] of [["momo-psb","momo-payment-service-bank"],["lemfi","lemfi"]]) {
  const entry=manifest.entries.find((entry) => entry.slug===slug);
  entry.disposition="duplicate";entry.duplicate_of=duplicate;
  entry.reason=`Already published in the immutable legacy catalog as ${duplicate}. Keep current assets unchanged; metadata improvements are separate from replacement artwork.`;
}
for (const entry of manifest.entries) entry.reason=entry.reason.replace(/\s+/g," ");
manifest.summary=manifest.entries.reduce((result,entry)=>{result[entry.disposition]=(result[entry.disposition]??0)+1;return result;},{});
await writeFile(`${directory}manifest.json`,`${JSON.stringify(manifest,null,2)}\n`);
await writeFile(`${directory}reviews.json`,`${JSON.stringify(reviews,null,2)}\n`);
console.log("Recorded nine reviewed additions; retained existing MoMo and LemFi identities unchanged.");
