import promotedCatalog from "../../packages/logos/src/promoted-catalog.json";
import {
  logoCatalogSchema,
  type LogoEntry
} from "../../packages/logos/src/schema.js";

const coreEntries = [
  {
    name: "Moniepoint",
    slug: "moniepoint",
    category: "microfinance-bank",
    aliases: ["Moniepoint MFB", "TeamApt"],
    website: "https://moniepoint.com/",
    source_url: "https://moniepoint.com/icon.svg",
    source_type: "official-website",
    source_path: "assets/moniepoint.svg",
    svg_path: "assets/moniepoint.svg",
    formats: [
      {
        type: "svg",
        path: "assets/moniepoint.svg",
        mime_type: "image/svg+xml",
        width: null,
        height: null
      }
    ],
    added_at: "2026-06-23",
    updated_at: "2026-06-23",
    status: "verified"
  },
  {
    name: "OPay",
    slug: "opay",
    category: "fintech",
    aliases: ["OPay Nigeria", "Opera Pay"],
    website: "https://www.opayweb.com/",
    source_url: "https://gstatic.opayweb.com/website-ng/img/opay-logo.684aa98.svg",
    source_type: "official-website",
    source_path: "assets/opay.svg",
    svg_path: "assets/opay.svg",
    formats: [
      {
        type: "svg",
        path: "assets/opay.svg",
        mime_type: "image/svg+xml",
        width: null,
        height: null
      }
    ],
    added_at: "2026-06-23",
    updated_at: "2026-06-23",
    status: "verified"
  },
  {
    name: "Flutterwave",
    slug: "flutterwave",
    category: "fintech",
    aliases: ["Flutterwave Nigeria", "Flutterwave Payments"],
    website: "https://flutterwave.com/ng/",
    source_url: "https://flutterwave.com/images/logo/full.svg",
    source_type: "official-website",
    source_path: "assets/flutterwave.svg",
    svg_path: "assets/flutterwave.svg",
    formats: [
      {
        type: "svg",
        path: "assets/flutterwave.svg",
        mime_type: "image/svg+xml",
        width: null,
        height: null
      }
    ],
    added_at: "2026-06-23",
    updated_at: "2026-06-23",
    status: "verified"
  }
] satisfies LogoEntry[];

export const liveLogoCatalog = logoCatalogSchema
  .parse([...coreEntries, ...promotedCatalog])
  .filter((logo) => logo.status !== "deprecated");
