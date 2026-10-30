// Preview database testing must not send maintainer emails or create real issues.
// Production can never opt into this guard through the configuration flag alone.
export function previewDeliveryDisabled() {
  return process.env.VERCEL_ENV === "preview" && process.env.DISABLE_PREVIEW_DELIVERY === "true";
}
