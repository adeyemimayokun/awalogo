import type { z } from "zod";
import type { productEventSchema } from "../../../packages/admin/events";
import { shouldTrackAnalytics } from "./site-analytics";
type Event = z.infer<typeof productEventSchema>;
export function trackProduct(
  event: Event["event"],
  data: Partial<Pick<Event, "resource" | "detail">> & { format?: string } = {},
) {
  try {
    if (
      !shouldTrackAnalytics({
        productionBuild: import.meta.env.PROD,
        enabled: import.meta.env.VITE_ENABLE_PRODUCT_ANALYTICS,
        url: location.href,
        privacyOptOut:
          navigator.doNotTrack === "1" ||
          (navigator as Navigator & { globalPrivacyControl?: boolean })
            .globalPrivacyControl === true,
      })
    )
      return;
    void fetch("/api/logo-requests?view=events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: crypto.randomUUID(), event, ...data }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* Analytics must never interrupt the user's action. */
  }
}
