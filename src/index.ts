import { handleProxy, ProxyConfig } from "./lib/proxy";
import { logProxyEvent } from "./lib/logger";

export interface Env {
  ALLOWED_ORIGINS?: string;
  TRUSTED_HOSTS?: string;
}

// Configuration
const DEFAULT_CONFIG: Partial<ProxyConfig> = {
  maxContentLength: 5 * 1024 * 1024 * 1024, // 5GB
};

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Range, Origin, Referer",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Only allow GET requests
    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "pipe.sideby.me" });
    }

    // Build config from environment
    const allowedOrigins = env.ALLOWED_ORIGINS?.split(",").map((o) =>
      o.trim()
    ) || ["*"];

    const trustedHosts = env.TRUSTED_HOSTS?.split(",").map((h) => h.trim());

    // Validate origin/referer - block direct access
    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");
    const refererOrigin = referer ? new URL(referer).origin : null;
    const requestOrigin = origin || refererOrigin;

    // Skip validation if wildcard allowed or it's a same-origin request (HLS segments)
    const isAllowed =
      allowedOrigins.includes("*") ||
      (requestOrigin && allowedOrigins.includes(requestOrigin)) ||
      (refererOrigin && refererOrigin === url.origin); // HLS segments have referer = pipe.sideby.me

    if (!isAllowed) {
      return Response.json(
        { error: "Forbidden: requests must originate from allowed origins" },
        { status: 403, headers: { "x-proxy-reason": "origin-blocked" } }
      );
    }

    const config: ProxyConfig = {
      ...DEFAULT_CONFIG,
      allowedOrigins,
      proxyBaseUrl: url.origin,
      maxContentLength: DEFAULT_CONFIG.maxContentLength!,
      trustedHosts,
    };

    // Handle proxy request
    const targetParam = url.searchParams.get("url");
    const { response, proxyReason } = await handleProxy(request, config);

    // Log proxy failures for debugging
    if (
      proxyReason !== "pass-through" &&
      proxyReason !== "m3u8-rewrite" &&
      proxyReason !== "range-synthesized"
    ) {
      logProxyEvent({
        source: "proxy-failure",
        testedUrl: targetParam,
        proxyReason,
        upstreamStatus: response.headers.get("x-proxy-origin-status"),
      });
    }

    return response;
  },
};
