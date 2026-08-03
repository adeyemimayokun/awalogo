import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueSession, readSession } from "./auth";

type TestResponse = VercelResponse & { headers: Map<string, string | string[] | number> };

function response(): TestResponse {
  const headers = new Map<string, string | string[] | number>();
  return {
    headers,
    setHeader(name: string, value: string | string[] | number) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    }
  } as TestResponse;
}

const originalEnvironment = { ...process.env };

describe("admin sessions", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-secret-that-is-definitely-longer-than-thirty-two-characters";
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("encrypts and restores the GitHub session token", () => {
    const result = response();
    issueSession(result, "maintainer", "https://example.com/avatar.png", "github-sensitive-token");
    const setCookie = result.getHeader("Set-Cookie");
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : String(setCookie)).split(";")[0];

    expect(cookie).not.toContain("github-sensitive-token");
    expect(readSession({
      headers: { host: "awalogo.com", cookie },
      query: {}
    } as VercelRequest)).toMatchObject({
      login: "maintainer",
      githubToken: "github-sensitive-token"
    });
  });

  it("rejects a modified encrypted session", () => {
    const result = response();
    issueSession(result, "maintainer", "https://example.com/avatar.png", "github-sensitive-token");
    const setCookie = result.getHeader("Set-Cookie");
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : String(setCookie)).split(";")[0];
    const [name, value] = cookie.split("=");
    const parts = value.split(".");
    const ciphertext = parts[2];
    const middle = Math.floor(ciphertext.length / 2);
    parts[2] = `${ciphertext.slice(0, middle)}${ciphertext[middle] === "a" ? "b" : "a"}${ciphertext.slice(middle + 1)}`;
    const modified = `${name}=${parts.join(".")}`;

    expect(readSession({
      headers: { host: "awalogo.com", cookie: modified },
      query: {}
    } as VercelRequest)).toBeNull();
  });
});
