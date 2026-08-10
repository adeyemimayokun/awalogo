import type { RuntimeCatalog } from "@awalogo/catalog-ui/runtime-catalog";

export type UiToPluginMessage =
  | { type: "insert-logo"; name: string; svg: string; width: number; height: number }
  | { type: "insert-image"; name: string; mimeType: "image/png" | "image/webp" | "image/jpeg"; bytes: number[]; width: number; height: number }
  | { type: "catalog-load"; requestId: string; force?: boolean }
  | { type: "asset-load"; requestId: string; url: string; checksum: string }
  | { type: "close" };

export type PluginToUiMessage =
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

export function isUiToPluginMessage(value: unknown): value is UiToPluginMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  if (message.type === "close") return true;
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
