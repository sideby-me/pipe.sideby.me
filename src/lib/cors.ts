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

  // Check if origin is allowed
  if (
    origin &&
    (allowedOrigins.includes(origin) || allowedOrigins.includes("*"))
  ) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
  } else if (allowedOrigins.length > 0) {
    corsHeaders["Access-Control-Allow-Origin"] = allowedOrigins[0];
  } else {
    corsHeaders["Access-Control-Allow-Origin"] = "*";
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
