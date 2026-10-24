import { z } from "zod";
export const eventNames = [
  "panel-open",
  "download",
  "zip-ready",
  "bag-pack",
  "bag-drop",
  "bag-drop-all",
  "bag-undo",
  "code-copy",
  "search",
  "filter",
  "request",
  "report",
] as const;
export const productEventSchema = z
  .object({
    id: z.string().uuid(),
    event: z.enum(eventNames),
    resource: z
      .string()
      .regex(/^[a-zA-Z0-9:-]*$/)
      .max(240)
      .default(""),
    format: z.enum(["", "svg", "png", "webp", "jpeg", "zip"]).default(""),
    detail: z
      .enum([
        "",
        "0",
        "1-10",
        "11-50",
        "51+",
        "category",
        "industry",
        "market",
        "region",
        "logos",
        "flags",
        "html",
        "react",
        "svg",
        "inline",
        "individual",
        "bundle",
      ])
      .default(""),
  })
  .strict();
