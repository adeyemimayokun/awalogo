import type { IncomingMessage, ServerResponse } from "node:http";

// Vercel supplies these helpers at runtime; no builder SDK is needed for types.
export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
  body: any;
}

export interface VercelResponse extends ServerResponse {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  redirect(status: number, url: string): VercelResponse;
}
