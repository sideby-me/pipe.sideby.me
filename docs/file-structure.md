# File Structure

This is a high-level overview of the pipe.sideby.me file structure as implemented today.

- `src/`
  - `index.ts` — Worker entry point; handles routing, origin validation, and dispatches to `handleProxy`.
  - `lib/`
    - `proxy.ts` — Core proxy logic: upstream fetching, retry strategies, range synthesis, and content-type detection.
    - `ssrf.ts` — SSRF protection: DNS-over-HTTPS lookup and private IP range blocking.
    - `m3u8.ts` — HLS manifest parsing and URL rewriting.
    - `headers.ts` — Builds spoofed request headers for upstream fetches.
    - `cors.ts` — CORS preflight handling and header attachment.
    - `config.ts` — Environment parsing and `Config` type.
    - `logger.ts` — Structured logging helper.
    - `types.ts` — Shared types (`ProxyReason`, etc.).
- `wrangler.toml` — Cloudflare Wrangler configuration (routes, environment bindings).
- `tsconfig.json` — TypeScript configuration.
- `package.json` — Dependencies and npm scripts.
