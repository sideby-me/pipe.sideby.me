// M3U8/HLS manifest rewrites segment and key URLs to go through the proxy

// Create a proxy URL for a given target URL, optionally preserving headers
export function proxifyURL(
  targetUrl: string,
  proxyBaseUrl: string,
  preserveHeaders?: string
): string {
  const params = new URLSearchParams({ url: targetUrl });
  if (preserveHeaders) {
    params.set("headers", preserveHeaders);
  }
  return `${proxyBaseUrl}?${params.toString()}`;
}

// Check if a content-type indicates an M3U8/HLS manifest
export function isM3U8ContentType(
  contentType: string,
  pathname: string
): boolean {
  const lowered = contentType.toLowerCase();
  return (
    lowered.includes("application/vnd.apple.mpegurl") ||
    lowered.includes("application/x-mpegurl") ||
    lowered.includes("audio/mpegurl") ||
    pathname.toLowerCase().includes(".m3u8")
  );
}

// Rewrite an M3U8 manifest to proxy all segment/key URLs
export function rewriteM3U8(
  manifest: string,
  baseUrl: URL,
  proxyBaseUrl: string
): string {
  const lines = manifest.split(/\r?\n/);

  // Extract headers from the original manifest URL to preserve for segments
  const originalHeaders = baseUrl.searchParams.get("headers");

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Handle EXT-X-KEY and EXT-X-MAP tags with URI attributes
      if (
        trimmed.startsWith("#EXT-X-KEY") ||
        trimmed.startsWith("#EXT-X-MAP")
      ) {
        return line.replace(/URI="([^"]+)"/i, (_match, uri: string) => {
          try {
            const absolute = new URL(uri, baseUrl).toString();
            return `URI="${proxifyURL(absolute, proxyBaseUrl, originalHeaders || undefined)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      // Skip other comment lines
      if (trimmed.startsWith("#")) return line;

      // Regular line = segment/playlist URL
      try {
        const absolute = new URL(trimmed, baseUrl).toString();
        return proxifyURL(absolute, proxyBaseUrl, originalHeaders || undefined);
      } catch {
        return line;
      }
    })
    .join("\n");
}
