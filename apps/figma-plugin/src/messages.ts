import type { RuntimeCatalog } from "@awalogo/catalog-ui/runtime-catalog";
import { parsePack, type PackEntry } from "./pack";

export type UiToPluginMessage =
  | { type: "insert-pack"; requestId: string; items: PackInsertItem[] }
  | { type: "pack-load"; requestId: string }
  | { type: "pack-save"; entries: PackEntry[] }
  | { type: "insert-logo"; name: string; svg: string; width: number; height: number }
  | { type: "insert-image"; name: string; mimeType: "image/png" | "image/webp" | "image/jpeg"; bytes: number[]; width: number; height: number }
  | { type: "catalog-load"; requestId: string; force?: boolean }
  | { type: "asset-load"; requestId: string; url: string; checksum: string }
  | { type: "close" };

export type PluginToUiMessage =
  | { type: "pack-inserted"; requestId: string; count: number }
  | { type: "pack-result"; requestId: string; entries: PackEntry[] }
  | { type: "inserted"; name: string }
  | { type: "inserted-in-frame"; name: string }
  | { type: "replaced"; name: string }
  | { type: "clipped"; name: string }
  | { type: "catalog-result"; requestId: string; catalog: RuntimeCatalog; source: "network" | "cache"; stale: boolean }
  | { type: "asset-result"; requestId: string; checksum: string; bytes: number[]; source: "network" | "cache" }
  | { type: "request-error"; requestId: string; message: string; code: "offline" | "invalid" | "unavailable" }
  | { type: "error"; message: string };

export type PluginMessageEnvelope<T> = { pluginMessage?: T };

function hasValidDimensions(message: Record<string, unknown>) {
  return typeof message.width === "number" &&
    Number.isFinite(message.width) &&
    message.width >= 1 &&
    message.width <= 8192 &&
    typeof message.height === "number" &&
    Number.isFinite(message.height) &&
    message.height >= 1 &&
    message.height <= 8192;
}

export type PackInsertItem = Extract<UiToPluginMessage, { type: "insert-logo" | "insert-image" }>;

export function isUiToPluginMessage(value: unknown): value is UiToPluginMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  if (message.type === "insert-pack") return typeof message.requestId === "string" &&
    Array.isArray(message.items) && message.items.length > 0 && message.items.length <= 50 &&
    message.items.every((item) => !!item && typeof item === "object" &&
      (item.type === "insert-logo" || item.type === "insert-image") && isUiToPluginMessage(item) &&
      (item.type !== "insert-logo" || (item.svg.length <= 1_500_000 && item.svg.trim().startsWith("<svg"))));
  if (message.type === "close") return true;
  if (message.type === "pack-load") return typeof message.requestId === "string";
  if (message.type === "pack-save") {
    try { return Array.isArray(message.entries) && message.entries.length <= 50 && parsePack(JSON.stringify(message.entries)).length === message.entries.length; }
    catch { return false; }
  }
  if (message.type === "catalog-load") return typeof message.requestId === "string";
  if (message.type === "asset-load") return typeof message.requestId === "string" &&
    typeof message.url === "string" && typeof message.checksum === "string";
  if (message.type === "insert-logo") return (
    typeof message.name === "string" &&
    typeof message.svg === "string" &&
    hasValidDimensions(message)
  );
  if (message.type !== "insert-image") return false;
  return typeof message.name === "string" &&
    (message.mimeType === "image/png" || message.mimeType === "image/webp" || message.mimeType === "image/jpeg") &&
    Array.isArray(message.bytes) &&
    message.bytes.length > 0 &&
    message.bytes.length <= 10_000_000 &&
    message.bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255) &&
    hasValidDimensions(message);
}
