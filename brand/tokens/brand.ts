export const awalogoBrand = {
  name: "awalogo",
  tagline: "Nigerian financial logos, ready to use.",
  colors: {
    ink: "#111411",
    surface: "#242925",
    lime: "#D8EF55",
    limeDeep: "#B8D93D",
    paper: "#F7F7F2",
    white: "#FFFFFF",
    muted: "#686A64",
    line: "#E1E4DD",
  },
  fonts: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  },
  radii: { small: 4, default: 6, large: 8 },
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 },
  motion: {
    fast: 160,
    default: 240,
    campaign: 500,
    easeOut: [0.16, 1, 0.3, 1] as const,
  },
} as const;

export type AwalogoBrand = typeof awalogoBrand;
