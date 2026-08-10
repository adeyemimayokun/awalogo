import { isUiToPluginMessage, type PluginToUiMessage } from "./messages";
import { CATALOG_ORIGIN, CATALOG_PATH, parseRuntimeCatalog, type RuntimeCatalog } from "@awalogo/catalog-ui/runtime-catalog";
import { trimAssetCache, type AssetCacheEntry } from "./cache-policy";
import { readResponseHeader } from "./response-headers";

figma.showUI(__html__, {
  width: 420,
  height: 620,
  themeColors: true
});

const MAX_SVG_LENGTH = 1_500_000;
const INSERTED_LOGO_KEY = "awalogo:inserted";
const CATALOG_CACHE_KEY = "awalogo:catalog:v1";
const ASSET_INDEX_KEY = "awalogo:asset-index:v1";
const ASSET_KEY_PREFIX = "awalogo:asset:v1:";
const CATALOG_URL = `${CATALOG_ORIGIN}${CATALOG_PATH}`;
const CATALOG_TIMEOUT_MS = 8_000;
type CatalogCache = { catalog: RuntimeCatalog; etag?: string; fetchedAt: number };
type ClipShapeNode = RectangleNode | EllipseNode | PolygonNode | StarNode | VectorNode | BooleanOperationNode;
type InsertedLogoNode = RectangleNode | FrameNode;

const CLIP_SHAPE_TYPES = new Set<SceneNode["type"]>([
  "RECTANGLE",
  "ELLIPSE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "BOOLEAN_OPERATION"
]);

function postToUi(message: PluginToUiMessage) {
  figma.ui.postMessage(message);
}

function requestError(requestId: string, message: string, code: "offline" | "invalid" | "unavailable") {
  postToUi({ type: "request-error", requestId, message, code });
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function catalogAssetUrl(value: string) {
  const prefix = `${CATALOG_ORIGIN}/catalog/v1/assets/`;
  return value.startsWith(prefix) && !value.slice(prefix.length).includes("/") ? value : null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error("Request timed out")), timeoutMs))
  ]);
}

async function loadCatalog(requestId: string, force = false) {
  const stored = await figma.clientStorage.getAsync(CATALOG_CACHE_KEY) as CatalogCache | undefined;
  let cached: CatalogCache | undefined;
  try {
    if (stored) cached = { ...stored, catalog: parseRuntimeCatalog(stored.catalog) };
  } catch {
    await figma.clientStorage.deleteAsync(CATALOG_CACHE_KEY);
  }
  try {
    const headers = !force && cached?.etag ? { "If-None-Match": cached.etag } : undefined;
    const response = await withTimeout(fetch(CATALOG_URL, { headers }), CATALOG_TIMEOUT_MS);
    if (response.status === 304 && cached) {
      postToUi({ type: "catalog-result", requestId, catalog: cached.catalog, source: "cache", stale: false });
      return;
    }
    if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`);
    const catalog = parseRuntimeCatalog(await response.json());
    const nextCache: CatalogCache = {
      catalog,
      etag: readResponseHeader(response, "etag"),
      fetchedAt: Date.now()
    };
    await figma.clientStorage.setAsync(CATALOG_CACHE_KEY, nextCache).catch(() => undefined);
    postToUi({ type: "catalog-result", requestId, catalog, source: "network", stale: false });
  } catch (error) {
    if (cached) {
      postToUi({ type: "catalog-result", requestId, catalog: cached.catalog, source: "cache", stale: true });
      return;
    }
    requestError(requestId, errorMessage(error, "The production catalog is unavailable. Deploy awalogo.com and try again."), "offline");
  }
}

async function loadAsset(requestId: string, urlValue: string, checksum: string) {
  const url = catalogAssetUrl(urlValue);
  if (!url || !/^[a-f0-9]{64}$/.test(checksum) || !url.includes(checksum)) {
    requestError(requestId, "The requested asset is not trusted.", "invalid");
    return;
  }

  const cacheKey = `${ASSET_KEY_PREFIX}${checksum}`;
  const cachedBytes = await figma.clientStorage.getAsync(cacheKey) as Uint8Array | undefined;
  if (cachedBytes instanceof Uint8Array) {
    const index = (await figma.clientStorage.getAsync(ASSET_INDEX_KEY) as AssetCacheEntry[] | undefined) ?? [];
    const updated = index.map((entry) => entry.checksum === checksum ? { ...entry, lastUsed: Date.now() } : entry);
    await figma.clientStorage.setAsync(ASSET_INDEX_KEY, updated);
    postToUi({ type: "asset-result", requestId, checksum, bytes: Array.from(cachedBytes), source: "cache" });
    return;
  }

  try {
    const response = await withTimeout(fetch(url), CATALOG_TIMEOUT_MS);
    if (!response.ok) throw new Error(`Asset request failed with ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 10_000_000) throw new Error("Asset size is invalid");

    const index = (await figma.clientStorage.getAsync(ASSET_INDEX_KEY) as AssetCacheEntry[] | undefined) ?? [];
    const policy = trimAssetCache(index, { checksum, size: bytes.byteLength, lastUsed: Date.now() });
    await Promise.all(policy.evicted.map((evicted) => figma.clientStorage.deleteAsync(`${ASSET_KEY_PREFIX}${evicted}`)))
      .catch(() => undefined);
    if (policy.cacheIncoming) await figma.clientStorage.setAsync(cacheKey, bytes).catch(() => undefined);
    await figma.clientStorage.setAsync(ASSET_INDEX_KEY, policy.entries).catch(() => undefined);
    postToUi({ type: "asset-result", requestId, checksum, bytes: Array.from(bytes), source: "network" });
  } catch (error) {
    requestError(requestId, errorMessage(error, "The asset is unavailable."), "unavailable");
  }
}

function placeNode(node: SceneNode) {
  node.x = figma.viewport.center.x - node.width / 2;
  node.y = figma.viewport.center.y - node.height / 2;
  figma.currentPage.appendChild(node);
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

function selectedClipShape(): ClipShapeNode | null {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;
  const node = selection[0];
  return CLIP_SHAPE_TYPES.has(node.type) && !node.locked ? node as ClipShapeNode : null;
}

function selectedFrame(): FrameNode | null {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;
  const node = selection[0];
  return node.type === "FRAME" && !node.locked ? node : null;
}

function selectedInsertedLogo(): InsertedLogoNode | null {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;
  const node = selection[0];
  if (node.type !== "RECTANGLE" && node.type !== "FRAME") return null;
  const isTagged = node.getPluginData(INSERTED_LOGO_KEY) === "true";
  const isLegacyPluginLogo = node.name.endsWith(" logo") && !node.name.includes(" · ");
  return isTagged || isLegacyPluginLogo ? node : null;
}

function markInsertedLogo(node: InsertedLogoNode) {
  node.setPluginData(INSERTED_LOGO_KEY, "true");
}

function replaceInsertedLogo(previous: InsertedLogoNode, replacement: InsertedLogoNode) {
  const parent = previous.parent;
  if (!parent || !("children" in parent)) return false;

  const index = parent.children.indexOf(previous);
  const geometry = {
    x: previous.x,
    y: previous.y,
    width: previous.width,
    height: previous.height,
    rotation: previous.rotation,
    constraints: previous.constraints,
    layoutPositioning: previous.layoutPositioning,
    layoutAlign: previous.layoutAlign,
    layoutGrow: previous.layoutGrow
  };

  parent.insertChild(index, replacement);
  replacement.resize(geometry.width, geometry.height);
  replacement.rotation = geometry.rotation;
  replacement.constraints = geometry.constraints;
  replacement.layoutPositioning = geometry.layoutPositioning;
  replacement.layoutAlign = geometry.layoutAlign;
  replacement.layoutGrow = geometry.layoutGrow;
  if (geometry.layoutPositioning === "ABSOLUTE" || !(parent.type === "FRAME" && parent.layoutMode !== "NONE")) {
    replacement.x = geometry.x;
    replacement.y = geometry.y;
  }
  markInsertedLogo(replacement);
  previous.remove();
  figma.currentPage.selection = [replacement];
  figma.viewport.scrollAndZoomIntoView([replacement]);
  return true;
}

function placeNodeInFrame(node: FrameNode | RectangleNode, frame: FrameNode) {
  frame.appendChild(node);
  if (frame.layoutMode !== "NONE") node.layoutPositioning = "ABSOLUTE";
  node.x = (frame.width - node.width) / 2;
  node.y = (frame.height - node.height) / 2;
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

function clippedToRaster(shape: ClipShapeNode, image: Image, name: string) {
  shape.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
  shape.name = `${shape.name} · ${name} logo`;
  figma.currentPage.selection = [shape];
  figma.viewport.scrollAndZoomIntoView([shape]);
}

function clippedToVector(shape: ClipShapeNode, logo: FrameNode, name: string): GroupNode | null {
  const parent = shape.parent;
  if (!parent || !(parent.type === "PAGE" || parent.type === "FRAME" || parent.type === "GROUP" || parent.type === "SECTION")) {
    return null;
  }

  const index = parent.children.indexOf(shape);
  parent.appendChild(logo);
  const scale = Math.max(shape.width / logo.width, shape.height / logo.height);
  logo.resize(Math.max(1, logo.width * scale), Math.max(1, logo.height * scale));
  logo.x = shape.x + (shape.width - logo.width) / 2;
  logo.y = shape.y + (shape.height - logo.height) / 2;

  const group = figma.group([shape, logo], parent, index);
  shape.isMask = true;
  shape.maskType = "ALPHA";
  group.name = `${name} clipped logo`;
  figma.currentPage.selection = [group];
  figma.viewport.scrollAndZoomIntoView([group]);
  return group;
}

figma.ui.onmessage = async (message: unknown) => {
  if (!isUiToPluginMessage(message)) return;

  if (message.type === "close") {
    figma.closePlugin();
    return;
  }

  if (message.type === "catalog-load") {
    await loadCatalog(message.requestId, message.force);
    return;
  }

  if (message.type === "asset-load") {
    await loadAsset(message.requestId, message.url, message.checksum);
    return;
  }

  if (message.type === "insert-image") {
    try {
      const image = figma.createImage(new Uint8Array(message.bytes));
      const replacementTarget = selectedInsertedLogo();
      if (replacementTarget) {
        const node = figma.createRectangle();
        node.name = `${message.name} logo`;
        node.resize(message.width, message.height);
        node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
        if (replaceInsertedLogo(replacementTarget, node)) {
          figma.notify(`Selected logo replaced with ${message.name}`, { timeout: 1800 });
          postToUi({ type: "replaced", name: message.name });
          return;
        }
      }
      const insertionFrame = selectedFrame();
      if (insertionFrame) {
        const node = figma.createRectangle();
        node.name = `${message.name} logo`;
        node.resize(message.width, message.height);
        node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
        markInsertedLogo(node);
        placeNodeInFrame(node, insertionFrame);
        figma.notify(`${message.name} inserted into selected frame`, { timeout: 1800 });
        postToUi({ type: "inserted-in-frame", name: message.name });
        return;
      }
      const clipShape = selectedClipShape();
      if (clipShape) {
        clippedToRaster(clipShape, image, message.name);
        figma.notify(`${message.name} clipped to selected shape`, { timeout: 1800 });
        postToUi({ type: "clipped", name: message.name });
        return;
      }
      const node = figma.createRectangle();
      node.name = `${message.name} logo`;
      node.resize(message.width, message.height);
      node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
      markInsertedLogo(node);
      placeNode(node);
      figma.notify(`${message.name} inserted`, { timeout: 1800 });
      postToUi({ type: "inserted", name: message.name });
    } catch (error) {
      postToUi({
        type: "error",
        message: error instanceof Error ? error.message : "Could not insert this image."
      });
    }
    return;
  }

  if (!message.svg.trim().startsWith("<svg") || message.svg.length > MAX_SVG_LENGTH) {
    postToUi({ type: "error", message: "This SVG is invalid or too large to insert." });
    return;
  }

  try {
    const replacementTarget = selectedInsertedLogo();
    const insertionFrame = selectedFrame();
    const clipShape = selectedClipShape();
    const node = figma.createNodeFromSvg(message.svg);
    node.name = `${message.name} logo`;
    node.resize(message.width, message.height);
    if (replacementTarget && replaceInsertedLogo(replacementTarget, node)) {
      figma.notify(`Selected logo replaced with ${message.name}`, { timeout: 1800 });
      postToUi({ type: "replaced", name: message.name });
      return;
    }
    if (insertionFrame) {
      markInsertedLogo(node);
      placeNodeInFrame(node, insertionFrame);
      figma.notify(`${message.name} inserted into selected frame`, { timeout: 1800 });
      postToUi({ type: "inserted-in-frame", name: message.name });
      return;
    }
    if (clipShape && clippedToVector(clipShape, node, message.name)) {
      figma.notify(`${message.name} clipped to selected shape`, { timeout: 1800 });
      postToUi({ type: "clipped", name: message.name });
      return;
    }
    markInsertedLogo(node);
    placeNode(node);

    figma.notify(`${message.name} inserted`, { timeout: 1800 });
    postToUi({ type: "inserted", name: message.name });
  } catch (error) {
    postToUi({
      type: "error",
      message: error instanceof Error ? error.message : "Could not insert this SVG."
    });
  }
};
