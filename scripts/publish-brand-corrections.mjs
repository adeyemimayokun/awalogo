import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import sharp from "sharp";

export async function publishBrandCorrections(root, check) {
  const base=join(root,"packages/brands");
  const reviews=JSON.parse(await readFile(join(base,"research/asset-corrections.json"),"utf8"));
  const legacy=JSON.parse(await readFile(join(root,"packages/catalog-ui/src/generated/runtime-catalog.json"),"utf8")).items.map((item)=>item.logo);
  const corrections=[], seen=new Set();
  const hash=(bytes)=>createHash("sha256").update(bytes).digest("hex");
  async function output(path,bytes) {
    if(check) { if(!(await readFile(path)).equals(Buffer.from(bytes))) throw new Error(`Stale V2 correction: ${path}`); }
    else { await mkdir(dirname(path),{recursive:true}); await writeFile(path,bytes); }
  }
  for(const review of reviews) {
    const current=legacy.find((item)=>item.slug===review.slug);
    if(!current || seen.has(review.slug) || current.formats[0]?.checksum!==review.expected_primary_checksum) throw new Error(`Unexpected correction target: ${review.slug}`);
    if(review.visual_reviewed!==true || !review.reviewed_at || review.review_notes.length<20 || !["light","dark"].includes(review.preview_background) || !/^assets\/[a-f0-9]{64}\.png$/.test(review.source_path)) throw new Error("Incomplete correction approval");
    for(const value of [review.website,review.source_url]) if(new URL(value).protocol!=="https:") throw new Error("HTTPS correction source required");
    const source=await readFile(join(base,review.source_path));
    if(hash(source)!==review.source_checksum) throw new Error("Correction source checksum mismatch");
    const trimmed=await sharp(source).trim({threshold:4}).toBuffer();
    const formats=[];
    for(const type of ["png","webp"]) {
      const renderer=sharp(trimmed).resize({width:1024,height:512,fit:"inside",withoutEnlargement:true});
      const bytes=type==="png"?await renderer.png().toBuffer():await renderer.webp({lossless:true,effort:3}).toBuffer();
      const checksum=hash(bytes), metadata=await sharp(bytes).metadata(), url=`/catalog/v2/assets/${checksum}.${type}`;
      await output(join(root,"apps/web/public",url),bytes);
      formats.push({type,url,mime_type:`image/${type}`,checksum,width:metadata.width,height:metadata.height,repository_path:review.source_path});
    }
    seen.add(review.slug);
    corrections.push({...review,formats});
  }
  const bytes=`${JSON.stringify({schema_version:1,corrections},null,2)}\n`;
  await output(join(base,"asset-corrections.json"),bytes);
  await output(join(root,"apps/web/public/catalog/v2/asset-corrections.json"),bytes);
}
