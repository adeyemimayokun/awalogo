import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { bundleLogos } from "./download.mjs";

const mapping = { access: "access-bank", gtb: "guaranty-trust-bank" };
const fixture = (type, content) => ({
  type, url: `/catalog/v1/assets/sample.${type}`,
  checksum: createHash("sha256").update(content).digest("hex"),
});
const svg = fixture("svg", "<svg/>");
const png = fixture("png", "png bytes");
const catalog = {
  schema_version: 1, catalog_version: "sample",
  items: [
    { logo: { slug: mapping.access, name: "Access Bank", formats: [png, svg] } },
    { logo: { slug: mapping.gtb, name: "Guaranty Trust Bank", formats: [png] } },
  ],
};
const fetcher = (data = catalog, pngResponse = () => new Response("png bytes")) => async (url) =>
  url.pathname.endsWith(".json") ? Response.json(data)
    : url.pathname.endsWith(".svg") ? new Response("<svg/>") : pngResponse();

let output;
beforeEach(async () => { output = await mkdtemp(join(tmpdir(), "awalogo-example-")); });
afterEach(async () => { await rm(output, { recursive: true, force: true }); });

it("bundles mapped IDs using SVG first and PNG fallback", async () => {
  const result = await bundleLogos(mapping, output, fetcher());
  expect(result.logos.access.file).toBe(`${svg.checksum}.svg`);
  expect(result.logos.gtb.file).toBe(`${png.checksum}.png`);
  expect(JSON.parse(await readFile(join(output, "manifest.json"), "utf8"))).toEqual(result);
  expect(await readFile(join(output, result.logos.access.file), "utf8")).toBe("<svg/>");
  expect(await readFile(join(output, result.logos.gtb.file), "utf8")).toBe("png bytes");
});

it.each([
  ["missing slug", { ...catalog, items: catalog.items.slice(0, 1) }, undefined, /Missing logo slug/],
  ["unsupported schema", { ...catalog, schema_version: 2 }, undefined, /Unsupported catalog schema/],
  ["failed download", catalog, () => new Response(null, { status: 503 }), /HTTP 503/],
  ["checksum mismatch", catalog, () => new Response("changed bytes"), /Checksum mismatch/],
])("preserves the previous bundle after %s", async (_label, data, response, error) => {
  await bundleLogos(mapping, output, fetcher());
  const snapshot = async () => Promise.all((await readdir(output)).map(async (name) => [name, await readFile(join(output, name))]));
  const before = await snapshot();
  await expect(bundleLogos(mapping, output, fetcher(data, response))).rejects.toThrow(error);
  expect(await snapshot()).toEqual(before);
});
