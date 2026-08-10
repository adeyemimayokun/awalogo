import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve(import.meta.dirname, "../manifest.json");

try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const requiredFields = ["name", "api", "main", "ui", "editorType", "documentAccess"];
  const missing = requiredFields.filter((field) => !manifest[field]);
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(", ")}`);
  if (manifest.documentAccess !== "dynamic-page") throw new Error('documentAccess must be "dynamic-page"');
  if (!Array.isArray(manifest.editorType) || !manifest.editorType.includes("figma")) {
    throw new Error('editorType must include "figma"');
  }
  if (JSON.stringify(manifest.networkAccess?.allowedDomains) !== JSON.stringify(["https://www.awalogo.com/catalog/"])) {
    throw new Error("networkAccess must be limited to the HTTPS awalogo catalog path");
  }
  if (!manifest.networkAccess?.reasoning?.includes("No analytics or user data")) {
    throw new Error("networkAccess.reasoning must explain the plugin's privacy boundary");
  }
  if (!Array.isArray(manifest.networkAccess?.devAllowedDomains)) {
    throw new Error("networkAccess.devAllowedDomains is required for local development");
  }
  const expectedDevDomains = ["http://localhost:5173", "http://localhost:5176"];
  if (JSON.stringify(manifest.networkAccess.devAllowedDomains) !== JSON.stringify(expectedDevDomains)) {
    throw new Error("networkAccess.devAllowedDomains must use supported localhost URLs");
  }
  console.log("Figma manifest is valid.");
} catch (error) {
  console.error(`Invalid Figma manifest: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
