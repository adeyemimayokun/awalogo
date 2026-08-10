import type { PluginMessageEnvelope, PluginToUiMessage, UiToPluginMessage } from "./messages";

export function isFigmaPlugin(): boolean {
  return window.parent !== window;
}

export function postToFigma(message: UiToPluginMessage): boolean {
  if (!isFigmaPlugin()) return false;
  window.parent.postMessage({ pluginMessage: message }, "*");
  return true;
}

export function subscribeToFigma(handler: (message: PluginToUiMessage) => void): () => void {
  const listener = (event: MessageEvent<PluginMessageEnvelope<PluginToUiMessage>>) => {
    const message = event.data?.pluginMessage;
    if (!message || typeof message !== "object" || !("type" in message)) return;
    handler(message);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

let requestSequence = 0;
type RequestPayload =
  | { type: "catalog-load"; force?: boolean }
  | { type: "asset-load"; url: string; checksum: string };

export function requestFromFigma<T extends PluginToUiMessage>(
  message: RequestPayload,
  expectedType: T["type"],
  timeoutMs = 10_000
): Promise<T> {
  const requestId = `request-${Date.now()}-${requestSequence++}`;
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("The request timed out."));
    }, timeoutMs);
    const unsubscribe = subscribeToFigma((response) => {
      if (!("requestId" in response) || response.requestId !== requestId) return;
      window.clearTimeout(timeout);
      unsubscribe();
      if (response.type === "request-error") {
        reject(new Error(response.message));
        return;
      }
      if (response.type !== expectedType) return;
      resolve(response as T);
    });
    if (!postToFigma({ ...message, requestId } as UiToPluginMessage)) {
      window.clearTimeout(timeout);
      unsubscribe();
      reject(new Error("Figma plugin messaging is unavailable."));
    }
  });
}
