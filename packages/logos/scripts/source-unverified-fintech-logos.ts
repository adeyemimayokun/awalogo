import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import sharp from "sharp";
import type { SourceType } from "../src/schema";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcingRoot = join(packageRoot, "sourcing");
const candidateRoot = join(sourcingRoot, "fintech-unverified-candidates");
const snapshotDate = "2026-08-02";
const userAgent = "Mozilla/5.0 (compatible; Awalogo/0.1; +https://awalogo.com/)";

type CandidateDefinition = {
  institution_slug: string;
  website: string;
  source_url: string;
  source_type: SourceType;
  extension: "svg" | "png" | "jpg";
  page_url?: string;
  selector?: string;
  replace_current_color?: boolean;
};

const candidates: CandidateDefinition[] = [
  {
    institution_slug: "global-accelerex",
    website: "https://www.globalaccelerex.com/",
    source_url: "https://www.globalaccelerex.com/images/Global-Accelerex-logo.png",
    source_type: "official-website",
    extension: "jpg"
  },
  {
    institution_slug: "coralpay",
    website: "https://customersupport.coralpay.com/portal/en/home",
    source_url: "https://contacts.zoho.com/file?ot=8&t=serviceorg&ID=798870174",
    source_type: "official-website",
    extension: "png"
  },
  {
    institution_slug: "moneymaster-payment-service-bank",
    website: "https://moneymasterpsb.com/",
    source_url: "https://moneymasterpsb.com/wp-content/uploads/2022/07/mmpsb-logo.png",
    source_type: "official-website",
    extension: "png"
  },
  {
    institution_slug: "suregifts",
    website: "https://www.suregifts.com.ng/",
    source_url: "https://www.suregifts.com.ng/register/personal#inline-logo",
    source_type: "official-website",
    extension: "svg",
    page_url: "https://www.suregifts.com.ng/register/personal",
    selector: "svg"
  },
  {
    institution_slug: "afriex",
    website: "https://www.afriex.com/",
    source_url: "https://cdn.prod.website-files.com/62ce94ab2b9c3a3597a7acd4/62d51c5a0476b26365bfe38c_Afriex%20i.svg",
    source_type: "official-website",
    extension: "svg"
  },
  {
    institution_slug: "nomba",
    website: "https://nomba.com/",
    source_url: "https://nomba.com/favicon.png",
    source_type: "official-website",
    extension: "png"
  },
  {
    institution_slug: "novacrust",
    website: "https://novacrust.com/",
    source_url: "https://novacrust.com/about-us#inline-logo",
    source_type: "official-website",
    extension: "svg",
    page_url: "https://novacrust.com/about-us",
    selector: "svg",
    replace_current_color: true
  },
  {
    institution_slug: "mercurie",
    website: "https://mercurie.ng/",
    source_url: "https://raw.githubusercontent.com/PaystackHQ/nigerialogos/master/public/logos/mercurie/mercurie.svg",
    source_type: "community-catalog",
    extension: "svg"
  },
  {
    institution_slug: "essential-finance",
    website: "https://lendsqr.com/",
    source_url: "https://raw.githubusercontent.com/PaystackHQ/nigerialogos/master/public/logos/lendsqr/lendsqr.svg",
    source_type: "community-catalog",
    extension: "svg"
  },
  {
    institution_slug: "spleet",
    website: "https://spleet.africa/",
    source_url: "https://raw.githubusercontent.com/PaystackHQ/nigerialogos/master/public/logos/spleet/spleet.svg",
    source_type: "community-catalog",
    extension: "svg"
  },
  {
    institution_slug: "thriveagric",
    website: "https://www.thriveagric.com/",
    source_url: "https://raw.githubusercontent.com/PaystackHQ/nigerialogos/master/public/logos/thrive_agric/thrive_agric.svg",
    source_type: "community-catalog",
    extension: "svg"
  }
];

const promotions = [];
const report = [];
for (const candidate of candidates) {
  let bytes = candidate.page_url
    ? await extractInlineSvg(candidate)
    : await download(candidate.source_url);
  if (candidate.extension === "svg") bytes = normalizeSvg(bytes, candidate.institution_slug);
  await validateAsset(bytes, candidate.extension, candidate.institution_slug);
  const directory = join(candidateRoot, candidate.institution_slug);
  const fileName = `${candidate.institution_slug}.${candidate.extension}`;
  const path = join(directory, fileName);
  await mkdir(directory, { recursive: true });
  await writeFile(path, bytes);
  const relativePath = `fintech-unverified-candidates/${candidate.institution_slug}/${fileName}`;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  promotions.push({
    institution_slug: candidate.institution_slug,
    candidate_path: relativePath,
    source_url: candidate.source_url,
    source_type: candidate.source_type,
    status: "needs-review",
    website: candidate.website,
    added_at: snapshotDate,
    updated_at: snapshotDate,
    reviewed: false
  });
  report.push({
    institution_slug: candidate.institution_slug,
    source_url: candidate.source_url,
    source_type: candidate.source_type,
    candidate_path: relativePath,
    sha256: checksum,
    disposition: "published-needs-review"
  });
}

await writeFile(
  join(sourcingRoot, "fintech-unverified-promotions.json"),
  `${JSON.stringify(promotions, null, 2)}\n`
);
await writeFile(
  join(sourcingRoot, "fintech-unverified-report.json"),
  `${JSON.stringify({
    generated_at: new Date().toISOString(),
    policy: "Unverified candidates are public only with needs-review status and retained source provenance.",
    published_needs_review: report.length,
    entries: report
  }, null, 2)}\n`
);
console.log(`Prepared ${promotions.length} unverified fintech logo candidates.`);

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "image/*,*/*;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Candidate download failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5_000_000) throw new Error(`Candidate exceeds 5 MB: ${url}`);
  return bytes;
}

async function extractInlineSvg(candidate: CandidateDefinition): Promise<Buffer> {
  const html = (await download(candidate.page_url!)).toString("utf8");
  const $ = load(html);
  const node = $(candidate.selector!).first();
  if (!node.length) throw new Error(`Inline logo not found: ${candidate.institution_slug}`);
  let svg = $.html(node);
  if (!svg) throw new Error(`Inline logo is empty: ${candidate.institution_slug}`);
  if (candidate.replace_current_color) svg = svg.replaceAll("currentColor", "#111111");
  return Buffer.from(`${svg}\n`);
}

async function validateAsset(bytes: Buffer, extension: CandidateDefinition["extension"], slug: string): Promise<void> {
  if (bytes.length < 32) throw new Error(`Candidate is truncated: ${slug}`);
  if (extension === "svg") {
    const value = bytes.toString("utf8");
    if (!/^\s*<svg[\s>]/i.test(value)) throw new Error(`Invalid SVG: ${slug}`);
    if (/<script|<foreignObject|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']https?:/i.test(value)) {
      throw new Error(`Unsafe SVG: ${slug}`);
    }
  }
  const metadata = await sharp(bytes, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 24 || metadata.height < 16) {
    throw new Error(`Candidate dimensions are invalid: ${slug}`);
  }
}

function normalizeSvg(bytes: Buffer, slug: string): Buffer {
  const $ = load(bytes.toString("utf8"), { xmlMode: true });
  const svg = $("svg").first();
  if (!svg.length) throw new Error(`Missing SVG root: ${slug}`);
  if (!svg.attr("viewBox")) {
    const width = Number.parseFloat(svg.attr("width") ?? "");
    const height = Number.parseFloat(svg.attr("height") ?? "");
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error(`Cannot derive SVG viewBox: ${slug}`);
    }
    svg.attr("viewBox", `0 0 ${width} ${height}`);
  }
  return Buffer.from(`${$.xml()}\n`);
}
