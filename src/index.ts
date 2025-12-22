import { handleProxy, ProxyConfig } from "./lib/proxy";

export interface Env {
  ALLOWED_ORIGINS?: string;
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
    const config: ProxyConfig = {
      ...DEFAULT_CONFIG,
      allowedOrigins,
      proxyBaseUrl: url.origin,
      maxContentLength: DEFAULT_CONFIG.maxContentLength!,
    };

    // Handle proxy request
    const { response } = await handleProxy(request, config);
    return response;
  },
};
