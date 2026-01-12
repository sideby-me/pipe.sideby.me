# Proxy and HLS Handling

This guide explains the core proxy behavior and how HLS manifests are handled.

## Proxy Logic (`proxy.ts`)

The `handleProxy` function is the heart of the worker:

1. **Extract target URL** from `?url=` query parameter.
2. **SSRF validation** — Call `validateUrl` to ensure the target hostname doesn't resolve to private IPs.
3. **Build headers** — Use `buildProxyHeaders` to spoof User-Agent, Referer, and Origin so upstream servers accept the request.
4. **Fetch upstream** — If the first attempt returns 403, retry with alternate headers (different User-Agent, no Referer).
5. **Detect content type** — Determine if the response is an HLS manifest (`.m3u8`, `application/vnd.apple.mpegurl`) or a media file.
6. **HLS rewrite** — If it's a manifest, pass the body to `rewriteM3U8` to replace segment/variant URLs with proxied versions.
7. **Range synthesis** — If the client requests a byte range but upstream ignores it, slice the response body before returning.
8. **Return response** — Attach CORS headers and a custom `x-proxy-reason` header for debugging.

### Retry Strategy

Some CDNs enforce hotlink protection; a 403 on the first attempt may succeed with:

- A different User-Agent (mobile vs desktop).
- Stripping the Referer/Origin.
- Adding the target's own origin as Referer.

## HLS Handling (`m3u8.ts`)

HLS manifests list URLs for media segments and variant playlists. `rewriteM3U8`:

1. Parses each line of the manifest.
2. If a line is a URL (absolute or relative), it's rewritten to:
   ```
   https://pipe.sideby.me/?url=<encoded-segment-url>
   ```
3. Relative URLs are resolved against the manifest's base URL first.

This ensures that subsequent segment fetches also route through the proxy, maintaining header spoofing and CORS.

## Range Request Synthesis

Some upstream servers don't support `Range` headers. When the client requests bytes `X–Y`:

1. Fetch the full resource.
2. Slice the body to the requested range.
3. Return with `206 Partial Content` and correct `Content-Range` header.

This allows seeking in players that depend on range requests.
