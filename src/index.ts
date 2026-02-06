import { handleProxy } from "./lib/proxy";
import { logger } from "./lib/logger";
import { Env, parseConfig } from "./lib/config";
import { handleOptions } from "./lib/cors";

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Build config from environment
    const config = parseConfig(env, url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request, config.allowedOrigins);
    }

    // Only allow GET requests
    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "pipe.sideby.me" });
    }

    // Validate origin/referer - block direct access
    // This logic enforces that requests come from allowed origins (or are same-origin/HLS)
    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");
    const refererOrigin = referer ? new URL(referer).origin : null;
    const requestOrigin = origin || refererOrigin;

    const isLocalWorkerHost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";

    // Skip validation if wildcard allowed or it's a same-origin request (HLS segments)
    const isAllowed =
      config.allowedOrigins.includes("*") ||
      (requestOrigin && config.allowedOrigins.includes(requestOrigin)) ||
      (refererOrigin && refererOrigin === url.origin) || // HLS segments have referer = pipe.sideby.me
      (!requestOrigin && isLocalWorkerHost); // Local dev direct hits have no Origin/Referer

    if (!isAllowed) {
      logger.warn("Origin/referer blocked", {
        origin,
        referer,
        refererOrigin,
        requestOrigin,
        url: request.url,
        userAgent: request.headers.get("User-Agent"),
        allowedOrigins: config.allowedOrigins,
      });
      return Response.json(
        { error: "Forbidden: requests must originate from allowed origins" },
        { status: 403, headers: { "x-proxy-reason": "origin-blocked" } }
      );
    }

    // Handle proxy request
    const targetParam = url.searchParams.get("url");
    const { response, proxyReason } = await handleProxy(request, config);

    // Log proxy failures for debugging
    if (
      proxyReason !== "pass-through" &&
      proxyReason !== "m3u8-rewrite" &&
      proxyReason !== "range-synthesized"
    ) {
      logger.warn("Proxy failure", {
        testedUrl: targetParam,
        proxyReason,
        upstreamStatus: response.headers.get("x-proxy-origin-status"),
      });
    }

    return response;
  },
};
