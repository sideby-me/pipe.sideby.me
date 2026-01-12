# Architecture

pipe.sideby.me is a Cloudflare Worker that proxies video streams for the main Sideby.me app. It handles CORS, HLS manifest rewriting, SSRF protection, and range-request synthesis—all at the edge.

At a high level:

- **Worker Entry** (`src/index.ts`) — The main fetch handler. Validates origin/referer, dispatches to proxy or health endpoints, and logs proxy outcomes.
- **Proxy Core** (`src/lib/proxy.ts`) — Fetches the upstream resource with retry logic, spoofs headers to bypass hotlink protection, synthesizes byte-range responses, and delegates HLS rewrites.
- **HLS Handling** (`src/lib/m3u8.ts`) — Parses HLS manifests (`.m3u8`) and rewrites segment/variant URLs to route through the proxy.
- **SSRF Protection** (`src/lib/ssrf.ts`) — Validates target URLs via DNS-over-HTTPS (DoH, 1.1.1.1) and blocks requests to private/internal IP ranges.
- **Headers** (`src/lib/headers.ts`) — Builds spoofed request headers (User-Agent, Referer, Origin) to maximize upstream success.
- **CORS** (`src/lib/cors.ts`) — Handles preflight OPTIONS and attaches permissive CORS headers for allowed origins.
- **Config** (`src/lib/config.ts`) — Parses environment variables and builds a typed `Config` object.
- **Logger** (`src/lib/logger.ts`) — Simple structured logging helper.
- **Types** (`src/lib/types.ts`) — Shared TypeScript types (`ProxyReason`, etc.).

## Request Flow

1. **Request arrives** at `https://pipe.sideby.me/?url=<encoded-target>`.
2. **Origin validation** — Reject requests that don't originate from allowed origins (unless wildcard or same-origin HLS segment).
3. **SSRF check** — Resolve target hostname via DoH; reject if it resolves to private IPs.
4. **Upstream fetch** — Fetch with spoofed headers; retry with alternate headers on 403.
5. **Content handling**:
   - **HLS manifests**: Rewrite URLs to proxy segments.
   - **Video/media**: Pass through, synthesizing range responses if needed.
6. **Response** — Return with CORS headers attached.
