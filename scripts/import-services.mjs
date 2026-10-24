import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = "packages/brands/", research = `${root}research/`, date = "2026-10-19";
const manifest = JSON.parse(await readFile(`${research}manifest.json`, "utf8"));
const reviews = JSON.parse(await readFile(`${research}reviews.json`, "utf8"));
const choices = [
  { slug: "jendol-superstores", index: 1, dark: true, aliases: ["Jendol", "Jendol Supermarket"] },
  { slug: "renee-supermarket", index: 0, aliases: ["Renee", "Renee Supermarket and Malls"], note: "Official social profile explicitly supplied by the user; original small profile artwork retained without upscaling." },
  { slug: "smile-communications", index: 0, aliases: ["Smile", "Smile Nigeria"], note: "The retrieved company website supplies this logo with a Beta label; no lettering was removed or recreated." },
  { slug: "mobitel-nigeria", index: 0, dark: true, aliases: ["Mobitel"], note: "Nigerian Mobitel identity from its company domain; availability in this asset library is not a claim that its historical broadband services remain active." },
  { slug: "cowry", index: 0, aliases: ["Cowry Card", "Cowry Transport", "Cowry App"], note: "The user confirmed the Lagos transport-payment brand, not Cowrywise." },
  { slug: "wakanow", index: 1, aliases: [], note: "Developer-supplied Wakanow app emblem; the unconfirmed regional-domain wordmark was excluded." },
  { slug: "lagride", index: 0, aliases: ["Lagos Ride", "Lagos City Cab"], website: "https://www.lagride.ng/" },
  { slug: "shuttlers", index: 0, aliases: [] },
  { slug: "chowdeck", index: 0, dark: true, aliases: [] },
  { slug: "glovo", index: 0, aliases: [], countryEvidence: "https://riderhub.glovoapp.com/ng/" },
  { slug: "dstv", index: 2, community: true, aliases: ["Digital Satellite Television"], note: "Community-sourced 2023 DStv identity, not the MultiChoice parent logo or MyDStv app icon. Not officially verified." },
  { slug: "gotv", index: 3, community: true, aliases: ["GOtv Nigeria"], note: "Community GOtv wordmark, not programme artwork, the MultiChoice parent logo or the MyGOtv app icon. Not officially verified." },
  { slug: "startimes", index: 0, dark: true, aliases: ["Star Times", "StarTimes Nigeria"], countryEvidence: "https://m.startimestv.com/browser/program/list" },
  { slug: "startimes-on", index: 1, aliases: ["StarTimesON", "Star Times ON"], website: "https://m.startimestv.com/browser", countryEvidence: "https://www.mtn.ng/play/startimes-on/", identity_resolution: "StarTimes ON is the separately branded StarTimes streaming app. The corporate StarTimes mark and the distinct ON developer app icon are separate identities, not duplicate company replacements." },
  { slug: "boxoffice", file: "/tmp/boxoffice-2.png", artwork: "https://www.nfvf.co.za/wp-content/uploads/2022/06/Box-Office-Report-2021_Infographic.pdf#page=16", community: true, aliases: ["Box Office", "DStv BoxOffice"], website: "https://www.dstv.com/en-ng/", countryEvidence: "https://www.dstv.com/en-ng/buy/dstv-packages/", identity_resolution: "BoxOffice is the separately named DStv movie rental product. It uses the historical product identity, never the parent DStv or MultiChoice logo.", note: "Original raster image extracted without tracing from page 16 of the NFVF 2021 report. This is a historical third-party publication, not official artwork verification by the brand owner; retained as community-source artwork." },
  { slug: "irokotv", index: 0, community: true, aliases: ["Iroko TV", "Iroko"], note: "Community IROKOtv image reviewed as an archival brand identity, not an assertion of current app availability. Not officially verified." },
  { slug: "ebonylife", index: 0, community: true, aliases: ["EbonyLife TV", "Ebony Life"], note: "Community EbonyLife TV mark, not the umbrella EbonyLife Media logo or the identities of its newer subsidiaries. Not officially verified; no current broadcast-service availability is asserted.", countryEvidence: "https://ebonylifetv.com/contact-us-2/" },
  { slug: "kava", index: 0, aliases: ["Kava TV"] },
  { slug: "nollistream", index: 1, aliases: ["Nolli Stream"], note: "Developer-supplied app icon linked from the official NolliStream website; homepage film poster and generic app-store badges explicitly excluded." },
  { slug: "showmax", index: 0, community: true, aliases: [], countryEvidence: "https://www.dstv.com/en-ng/", note: "Community 2024-era Showmax wordmark, not officially verified. CANAL+ announced Showmax's forthcoming discontinuation in 2026: https://www.canalplusgroup.com/en/mandatoryoffermultichoice/multichoice-post-76 . This is an archived brand identity, not a claim of current service availability." },
  { slug: "nibss", index: 0, aliases: ["Nigeria Inter-Bank Settlement System", "Nigeria Interbank Settlement System"] },
  { slug: "indrive", index: 0, aliases: ["inDriver", "in Drive"], countryEvidence: "https://blog.indrive.com/en-ci/article/meet-timothy-oladimeji-country-manager-for-nigeria" },
  { slug: "bolt", index: 0, dark: true, aliases: [], countryEvidence: "https://bolt.eu/en/cities/lagos/" },
  { slug: "mano", index: 0, aliases: ["MANO App", "Mano Africa"] },
  { slug: "gokada", index: 1, aliases: [] },
  { slug: "giggo", index: 2, aliases: ["GIG GO", "GIG Logistics App"], identity_resolution: "GIGGO is the separately branded GIG Logistics delivery app. Its official developer listing establishes the relationship; the distinct app icon is used and the existing parent-company record remains unchanged.", note: "Developer-supplied GIGGO app icon. The GIG Logistics corporate mark and unrelated slider artwork are excluded." },
  { slug: "kwik", index: 0, aliases: ["Kwik Delivery"] },
  { slug: "sendbox", index: 0, aliases: ["Send Box"] },
  { slug: "foodcourt", index: 0, aliases: ["Food Court", "CoKitchen"], note: "Original PNG bytes extracted from the official header's embedded SVG image; no vector claim, tracing, or enlargement." }
];
for (const choice of choices) {
  if (reviews.some((review) => review.slug === choice.slug)) throw new Error(`Already reviewed ${choice.slug}`);
  const entry = manifest.entries.find((candidate) => candidate.slug === choice.slug);
  if (!entry) throw new Error(`Missing candidate ${choice.slug}`);
  let asset = entry.candidate_assets[choice.index ?? 0];
  if (choice.file) {
    const bytes = await readFile(choice.file), metadata = await sharp(bytes).metadata();
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const path = `staging/${choice.slug}-reviewed-${checksum.slice(0,12)}.${metadata.format}`;
    await copyFile(choice.file, `${root}${path}`);
    asset = { path, source_url: choice.artwork, discovered_on: choice.artwork, source_type: "community-catalog", format: metadata.format, width: metadata.width, height: metadata.height, checksum, retrieved_at: date, reviewed: false };
    entry.candidate_assets.push(asset);
    const pdf = await readFile("/tmp/boxoffice-source.pdf");
    const pdfHash = createHash("sha256").update(pdf).digest("hex");
    await copyFile("/tmp/boxoffice-source.pdf", `${research}evidence/${pdfHash}.pdf`);
  }
  if (!asset) throw new Error(`Missing artwork ${choice.slug}`);
  const community = !!choice.community;
  if (community !== (asset.source_type === "community-catalog")) throw new Error(`Provenance mismatch ${choice.slug}`);
  const note = `${community ? "Manually reviewed third-party artwork; brand ownership checked separately, artwork not officially verified." : "Company website or developer-supplied artwork visually reviewed."} Parent, partner, programme artwork and unrelated app badges excluded. Raster originals are not traced or upscaled. Artwork provenance is not a trademark licence. ${choice.note ?? ""}`.trim();
  asset.reviewed = true;
  const evidence = [{ url: asset.discovered_on, note: community ? "Reviewed third-party artwork source; does not establish official verification or trademark permission." : "Company-controlled website or developer listing supplies the reviewed brand artwork.", retrieved_at: date }, { url: choice.countryEvidence ?? entry.website, note: "Evidence of Nigerian or African brand operations; inclusion does not assert continued service availability for archival identities.", retrieved_at: date }];
  reviews.push({ slug: choice.slug, decision: "approved", asset_path: asset.path, reviewer: "Codex assisted source and visual review", reviewed_at: date, ownership_checked: true, visual_reviewed: true, review_notes: note, origin_country: null, headquarters_country: null, operating_countries: ["NG"], preview_background: choice.dark ? "dark" : "light", evidence, aliases: choice.aliases, ...(choice.identity_resolution ? { identity_resolution: choice.identity_resolution } : {}), ...(choice.website ? { website: choice.website } : {}), source_type: community ? "community-catalog" : "official-website", status: community ? "needs-review" : "verified", trim_padding: asset.format !== "svg", without_enlargement: true, batch: `requested-services-${entry.industry === "media-entertainment" ? "media" : "mobility-retail"}-${date}` });
  entry.disposition = "approved";
  entry.reason = note;
}
for (const entry of manifest.entries) entry.reason = entry.reason.replace(/\s+/g, " ").trim();
manifest.summary = manifest.entries.reduce((counts, entry) => { counts[entry.disposition] = (counts[entry.disposition] ?? 0) + 1; return counts; }, {});
await writeFile(`${research}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(`${research}reviews.json`, `${JSON.stringify(reviews, null, 2)}\n`);
await copyFile("/tmp/services-baseline.json", `${research}services-baseline.json`);
console.log(`Reviewed ${choices.length} additions in two batches; Swift Networks and Coollink remain unchanged.`);
