export function createCORSHeaders(
  origin: string | null,
  allowedOrigins: string[]
): Record<string, string> {
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Origin, Referer",
    "Access-Control-Expose-Headers":
      "Content-Range, Accept-Ranges, Content-Length",
    Vary: "Origin, Range",
  };

  const hasWildcard = allowedOrigins.includes("*");

  // Only emit ACAO when the origin is explicitly allowed or wildcard is configured and don't fall back to an arbitrary allowed origin when the incoming origin
  if (hasWildcard) {
    corsHeaders["Access-Control-Allow-Origin"] = "*";
  } else if (origin && allowedOrigins.includes(origin)) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
  }

  return corsHeaders;
}

export function handleOptions(
  request: Request,
  allowedOrigins: string[]
): Response {
  const origin = request.headers.get("Origin");
  const headers = createCORSHeaders(origin, allowedOrigins);

  // Specific headers for preflight
  headers["Access-Control-Max-Age"] = "86400";

  return new Response(null, {
    status: 204,
    headers,
  });
}
