import { logger } from "./logger";

export function buildForwardHeaders(
  targetUrl: URL,
  clientHeaders: {
    range?: string | null;
    referer?: string | null;
    userAgent?: string | null;
    acceptLanguage?: string | null;
  }
): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent":
      clientHeaders.userAgent || "Mozilla/5.0 (compatible; SidebyProxy/1.0)",
    Accept: "*/*",
    "Accept-Language": clientHeaders.acceptLanguage || "en-US,en;q=0.9",
  };

  // Add range header if provided
  if (clientHeaders.range) {
    headers["Range"] = clientHeaders.range;
  }

  // Check for embedded headers in the target URL (e.g., ?headers={"referer":"..."})
  // Some video sites embed required headers in the URL itself
  let embeddedReferer: string | null = null;
  let embeddedOrigin: string | null = null;
  try {
    const embeddedHeaders = targetUrl.searchParams.get("headers");
    if (embeddedHeaders) {
      const parsed = JSON.parse(embeddedHeaders);
      embeddedReferer = parsed.referer || parsed.Referer || null;
      embeddedOrigin = parsed.origin || parsed.Origin || null;
    }
  } catch {
    // Ignore parse errors
  }

  // Try to extract origin from URL path for CDN proxies like workers.dev
  let pathExtractedOrigin: string | null = null;
  if (targetUrl.hostname.includes("workers.dev")) {
    const pathParts = targetUrl.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      const firstPart = pathParts[0];
      // Check if it looks like a domain (contains a dot, not a file extension)
      if (
        firstPart.includes(".") &&
        !firstPart.match(/\.(m3u8|ts|mp4|jpg|png|ico|html|js|css)$/i)
      ) {
        pathExtractedOrigin = `https://${firstPart}`;
      }
    }
  }

  // Priority: embedded headers > path-extracted origin > referer param > target origin fallback
  const effectiveReferer =
    embeddedReferer || pathExtractedOrigin || clientHeaders.referer;
  const effectiveOrigin =
    embeddedOrigin || (pathExtractedOrigin ? pathExtractedOrigin : null);
  const hasEmbeddedHeaders = !!embeddedReferer || !!embeddedOrigin;

  if (effectiveReferer) {
    try {
      new URL(effectiveReferer);
      headers["Referer"] = effectiveReferer.endsWith("/")
        ? effectiveReferer
        : `${effectiveReferer}/`;

      // Only send Origin when we have an explicit origin or when headers are not embedded-only.
      const shouldSendOrigin =
        !!effectiveOrigin || !hasEmbeddedHeaders || !!pathExtractedOrigin;
      if (shouldSendOrigin) {
        headers["Origin"] = effectiveOrigin || new URL(effectiveReferer).origin;
      }
    } catch {
      // Fallback if referer is invalid
      headers["Referer"] = `${targetUrl.origin}/`;
      headers["Origin"] = targetUrl.origin;
    }
  } else {
    headers["Referer"] = `${targetUrl.origin}/`;
    headers["Origin"] = targetUrl.origin;
  }

  return headers;
}
