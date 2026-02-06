export function buildForwardHeaders(clientHeaders: {
  range?: string | null;
  referer?: string | null;
  userAgent?: string | null;
  acceptLanguage?: string | null;
  origin?: string | null;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent":
      clientHeaders.userAgent || "SidebyProxy/1.0 (+https://watch.sideby.me)",
    Accept: "*/*",
    "Accept-Language": clientHeaders.acceptLanguage || "en-US,en;q=0.9",
  };

  // Add range header if provided
  if (clientHeaders.range) {
    headers["Range"] = clientHeaders.range;
  }

  if (clientHeaders.referer) {
    try {
      new URL(clientHeaders.referer);
      headers["Referer"] = clientHeaders.referer;
    } catch {
      // Skip invalid referer rather than synthesizing one.
    }
  }

  if (clientHeaders.origin) {
    try {
      new URL(clientHeaders.origin);
      headers["Origin"] = clientHeaders.origin;
    } catch {
      // Skip invalid origin rather than synthesizing one.
    }
  }

  return headers;
}
