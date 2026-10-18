import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { darkLogoPreviewAssetIds, institutionLogoLinks, logoCatalog } from "../../logos/src";
import promotedCatalog from "../../logos/src/promoted-catalog.json";
import { validateCatalog, validateFintechSourcingManifest } from "./validate";

describe("logo catalog validation", () => {
  it("keeps every primary and historical SVG renderable as a standalone image", () => {
    for (const logo of logoCatalog) {
      for (const asset of [logo, ...(logo.variations ?? [])]) {
        if (!asset.svg_path) continue;
        const svg = readFileSync(resolve("packages/logos/src", asset.svg_path), "utf8");
        const root = svg.match(/^<svg\b[^>]*>/)?.[0] ?? "";
        expect(root, asset.svg_path).toMatch(/\sxmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/);
      }
    }
  });
  it("keeps preview contrast entries linked to catalog assets", () => {
    const assetIds = new Set(logoCatalog.flatMap((logo) => [
      logo.slug,
      ...(logo.variations ?? []).map((variation) => `${logo.slug}-${variation.id}`)
    ]));

    expect(new Set(darkLogoPreviewAssetIds).size).toBe(darkLogoPreviewAssetIds.length);
    expect(darkLogoPreviewAssetIds.every((assetId) => assetIds.has(assetId))).toBe(true);
  });

  it("contains the seed and reviewed promotion catalog", () => {
    expect(logoCatalog).toHaveLength(promotedCatalog.length + 3);
    expect(logoCatalog.map((logo) => logo.slug)).toEqual(expect.arrayContaining([
      "flutterwave", "moniepoint", "opay", "kuda-microfinance-bank", "leadway-assurance-company",
      "busha-digital", "quidax-technologies", "paystack-payment", "united-bank-for-africa",
      "palmpay", "fairmoney-microfinance-bank", "vfd-microfinance-bank",
      "central-bank-of-nigeria", "securities-and-exchange-commission-nigeria",
      "nigeria-deposit-insurance-corporation", "federal-competition-and-consumer-protection-commission",
      "national-insurance-commission", "investnow", "piggyvest", "risevest", "trove-finance",
      "union-bank-of", "signature-bank", "meristem-securities", "cardinalstone-securities",
      "chapel-hill-denham", "afrinvest-securities", "arm-securities", "cordros-securities",
      "alat-by-wema", "aso-savings-loans", "brass", "buycoins", "fundall", "kora-payments",
      "monnify", "mono", "quickteller", "verve", "yellowcard", "zap",
      "abeg-technologies", "investnaija", "i-invest", "getequity", "wahed", "chaka-technologies",
      "ab-microfinance-bank-nigeria", "hilal-takaful", "xca-insurance-brokers",
      "citizens-pensions", "fcmb-pensions", "guaranty-trust-pension-managers",
      "npf-pension-managers", "premium-pension", "veritas-glanvills-pensions",
      "cardinal-stone-pensions", "parthian-pensions",
      "3line-card-management", "advansio", "ajocard", "anchor", "cleva", "flexipay",
      "klump-technology-company", "ladda", "lemfi", "payaza-africa", "ratefy", "timon",
      "umba-digital-solutions", "verifyme", "wealth-ng", "zedvance-finance",
      "global-accelerex", "coralpay", "moneymaster-payment-service-bank", "suregifts",
      "afriex", "nomba", "novacrust", "mercurie", "essential-finance", "spleet", "thriveagric",
      "dantown"
    ]));
  });

  it("keeps Nigeria Logos imports visibly pending official verification", () => {
    const imported = logoCatalog.filter((logo) => logo.source_type === "community-catalog");
    expect(imported.length).toBeGreaterThan(0);
    expect(imported.every((logo) => logo.status === "needs-review")).toBe(true);
  });

  it("maps shared institution brands to accepted logos", () => {
    const slugs = new Set(logoCatalog.map((logo) => logo.slug));
    for (const logoSlug of Object.values(institutionLogoLinks)) {
      expect(slugs.has(logoSlug)).toBe(true);
    }
  });

  it("has no validation issues", () => {
    expect(validateCatalog()).toEqual([]);
    expect(validateFintechSourcingManifest()).toEqual([]);
  });

  it("provides PNG and WebP for every accepted logo and preserves available SVGs", () => {
    for (const logo of logoCatalog) {
      expect(logo.formats.map((format) => format.type)).toEqual(expect.arrayContaining(["png", "webp"]));
      expect(logo.formats.some((format) => format.type === "svg")).toBe(Boolean(logo.svg_path));
    }
  });
});
