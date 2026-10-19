import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const directory="packages/brands/research/", date="2026-10-19";
const manifest=JSON.parse(await readFile(`${directory}manifest.json`,"utf8"));
const reviews=JSON.parse(await readFile(`${directory}reviews.json`,"utf8"));
const aliases=JSON.parse(await readFile(`${directory}search-aliases.json`,"utf8"));
const sources=[
  {slug:"abuja-electricity-distribution-company",index:1,aliases:["AEDC", "Abuja DisCo", "Abuja Electric"]},
  {slug:"benin-electricity-distribution-company",file:"/tmp/disco-benin-logo.png",artwork:"https://beninelectric.com/images/BEDCLogo.png",aliases:["BEDC", "Benin Electric", "Benin DisCo"]},
  {slug:"eko-electricity-distribution-company",index:0,aliases:["EKEDC", "EKEDP", "Eko DisCo"]},
  {slug:"enugu-electricity-distribution-company",file:"/tmp/disco-enugu-logo.png",artwork:"https://www.enugudisco.com/templates/kdsg2/images/s5_logo.png",aliases:["EEDC", "Enugu DisCo"]},
  {slug:"ibadan-electricity-distribution-company",index:0,aliases:["IBEDC", "Ibadan DisCo", "Ibadan Electric"]},
  {slug:"ikeja-electric",index:1,aliases:["IKEDC", "Ikeja Electricity Distribution Company", "Ikeja DisCo"]},
  {slug:"jos-electricity-distribution-company",index:0,aliases:["JED", "JEDC", "Jos DisCo", "Jos Electric"]},
  {slug:"kaduna-electric",index:0,aliases:["KAEDCO", "KDEDC", "Kaduna Electricity Distribution Company", "Kaduna DisCo"]},
  {slug:"kano-electricity-distribution-company",index:0,aliases:["KEDCO", "KEDC", "Kano DisCo", "Kano Electric"]},
  {slug:"port-harcourt-electricity-distribution-company",index:0,aliases:["PHED", "PHEDC", "Port Harcourt DisCo"]},
  {slug:"yola-electricity-distribution-company",index:0,aliases:["YEDC", "Yola DisCo", "Yola Electric"]},
  {slug:"aba-power",file:"/tmp/disco-aba-logo.jpeg",artwork:"https://www.abapower.com/apl-logo.jpg",aliases:["APLE", "Aba Power Limited Electric", "Aba Electricity", "APL Electric Company"]}
];
for(const item of sources) {
  if(reviews.some((review)=>review.slug===item.slug)) throw new Error(`Already reviewed ${item.slug}`);
  const entry=manifest.entries.find((entry)=>entry.slug===item.slug);
  if(!entry) throw new Error(`Missing candidate ${item.slug}`);
  let asset=entry.candidate_assets[item.index??0];
  if(item.file) {
    const bytes=await readFile(item.file), metadata=await sharp(bytes).metadata();
    const checksum=createHash("sha256").update(bytes).digest("hex");
    const path=`staging/${item.slug}-reviewed-${checksum.slice(0,12)}.${metadata.format}`;
    await copyFile(item.file,`packages/brands/${path}`);
    asset={path,source_url:item.artwork,discovered_on:entry.website,source_type:"official-website",format:metadata.format,width:metadata.width,height:metadata.height,checksum,retrieved_at:date,reviewed:true};
    entry.candidate_assets.push(asset);
  }
  if(!asset) throw new Error(`Missing selected artwork ${item.slug}`);
  const note="Official operator identity visually reviewed on light and dark backgrounds. Company-owned header artwork is used; payment-provider and partner logos are excluded. Raster originals are not traced or upscaled. Distribution-company status is evidenced separately from artwork provenance; no trademark licence is asserted.";
  const regulatory=item.slug==="aba-power"?"https://nerc.gov.ng/wp-content/uploads/2024/11/Aba-Power-Electricity-Distribution-Plc.-Monthly-Energy-Cap-November-2024.pdf":"https://nerc.gov.ng/need-help/services/licencees/";
  reviews.push({slug:item.slug,decision:"approved",asset_path:asset.path,reviewer:"Codex assisted source and visual review",reviewed_at:date,ownership_checked:true,visual_reviewed:true,review_notes:note,origin_country:null,headquarters_country:null,operating_countries:["NG"],preview_background:"light",evidence:[{url:entry.website,note:"Official website identifies this Nigerian electricity distribution operator and provides its reviewed brand artwork.",retrieved_at:date},{url:regulatory,note:"NERC operator records establish Nigerian electricity distribution operations; historical service boundaries are not asserted as current state-market exclusivity.",retrieved_at:date}],aliases:item.aliases,source_type:"official-website",trim_padding:asset.format!=="svg",without_enlargement:true,batch:"nigerian-discos-2026-10-19"});
  entry.disposition="approved";entry.reason=note;
  entry.sources.push({url:entry.website,type:"official-website",retrieved_at:date,title:entry.name,excerpt:"Reviewed official operator logo; CSS/application asset references inspected where static discovery missed it."});
  aliases[item.slug]={aliases:["DisCo","DisCos","electricity distribution", "electricity distribution companies"],source_url:regulatory};
}
manifest.summary=manifest.entries.reduce((result,entry)=>{result[entry.disposition]=(result[entry.disposition]??0)+1;return result;},{});
for(const [file,data]of[["manifest.json",manifest],["reviews.json",reviews],["search-aliases.json",aliases]]) await writeFile(`${directory}${file}`,`${JSON.stringify(data,null,2)}\n`);
console.log("Reviewed all eleven regional DisCos plus Aba Power; existing catalog entries untouched.");
