import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import adminCatalog from "../../api/admin/catalog";
import adminChangelog from "../../api/admin/changelog";
import adminLocalAsset from "../../api/admin/local-asset";
import adminMutate from "../../api/admin/mutate";
import adminNotifications from "../../api/admin/notifications";
import adminRequests from "../../api/admin/requests";
import adminSiteUpdates from "../../api/admin/site-updates";
import authCallback from "../../api/auth/callback";
import authGithub from "../../api/auth/github";
import authLogout from "../../api/auth/logout";
import authSession from "../../api/auth/session";
import logoRequests from "../../api/logo-requests";

type LocalRequest = IncomingMessage & {
  body?: unknown;
  query: Record<string, string | string[]>;
};

type LocalResponse = ServerResponse & {
  status(code: number): LocalResponse;
  json(body: unknown): LocalResponse;
  redirect(status: number, location: string): LocalResponse;
};

type ApiHandler = (request: never, response: never) => void | Promise<void>;

const handlers: Record<string, ApiHandler> = {
  "/api/admin/catalog": adminCatalog,
  "/api/admin/changelog": adminChangelog,
  "/api/admin/local-asset": adminLocalAsset,
  "/api/admin/mutate": adminMutate,
  "/api/admin/notifications": adminNotifications,
  "/api/admin/requests": adminRequests,
  "/api/admin/site-updates": adminSiteUpdates,
  "/api/auth/callback": authCallback,
  "/api/auth/github": authGithub,
  "/api/auth/logout": authLogout,
  "/api/auth/session": authSession,
  "/api/logo-requests": logoRequests
};

function queryFrom(url: URL): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams) {
    const current = query[key];
    query[key] = current === undefined ? value : Array.isArray(current) ? [...current, value] : [current, value];
  }
  return query;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (!request.headers["content-type"]?.includes("application/json")) return undefined;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 2_100_000) throw new Error("Request body exceeds the 2 MB development limit");
    chunks.push(buffer);
  }

  if (!chunks.length) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function adaptResponse(response: ServerResponse): LocalResponse {
  const adapted = response as LocalResponse;
  adapted.status = (code) => {
    adapted.statusCode = code;
    return adapted;
  };
  adapted.json = (body) => {
    if (!adapted.hasHeader("Content-Type")) adapted.setHeader("Content-Type", "application/json; charset=utf-8");
    adapted.end(JSON.stringify(body));
    return adapted;
  };
  adapted.redirect = (status, location) => {
    adapted.statusCode = status;
    adapted.setHeader("Location", location);
    adapted.end();
    return adapted;
  };
  return adapted;
}

export function localAdminApi(environment: Record<string, string>): Plugin {
  return {
    name: "awalogo-local-admin-api",
    apply: "serve",
    configureServer(server) {
      process.env.AWALOGO_LOCAL_ADMIN_BYPASS = "1";
      for (const [key, value] of Object.entries(environment)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }

      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
        const handler = handlers[url.pathname];
        if (!handler) return next();

        try {
          const adaptedRequest = request as LocalRequest;
          adaptedRequest.headers["x-awalogo-local-admin"] = "1";
          adaptedRequest.headers["x-forwarded-proto"] = url.protocol.slice(0, -1);
          adaptedRequest.query = queryFrom(url);
          adaptedRequest.body = await readJsonBody(request);
          await handler(adaptedRequest as never, adaptResponse(response) as never);
        } catch (error) {
          if (response.writableEnded) return;
          const message = error instanceof Error ? error.message : "Local API request failed";
          adaptResponse(response).status(message.includes("2 MB") ? 413 : 500).json({ error: message });
        }
      });
    }
  };
}
