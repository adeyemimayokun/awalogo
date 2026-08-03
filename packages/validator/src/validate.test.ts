import { describe, expect, it } from "vitest";
import { darkLogoPreviewAssetIds, institutionLogoLinks, logoCatalog } from "../../logos/src";
import { validateCatalog, validateFintechSourcingManifest } from "./validate";

describe("logo catalog validation", () => {
  it("keeps preview contrast entries linked to catalog assets", () => {
    const assetIds = new Set(logoCatalog.flatMap((logo) => [
      logo.slug,
      ...(logo.variations ?? []).map((variation) => `${logo.slug}-${variation.id}`)
    ]));

    expect(new Set(darkLogoPreviewAssetIds).size).toBe(darkLogoPreviewAssetIds.length);
    expect(darkLogoPreviewAssetIds.every((assetId) => assetIds.has(assetId))).toBe(true);
  });

  it("contains the seed and promotion catalog", () => {
    expect(logoCatalog).toHaveLength(232);
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
      "afriex", "nomba", "novacrust", "mercurie", "essential-finance", "spleet", "thriveagric"
    ]));
  });

  it("keeps Nigeria Logos imports visibly pending official verification", () => {
    const imported = logoCatalog.filter((logo) => logo.source_type === "community-catalog");
    expect(imported).toHaveLength(45);
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
