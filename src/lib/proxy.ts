// Video proxy core logic

import { validateURL } from "./ssrf";
import { isM3U8ContentType, rewriteM3U8 } from "./m3u8";

export interface ProxyConfig {
  allowedOrigins: string[];
  proxyBaseUrl: string;
  maxContentLength: number;
  trustedHosts?: string[];
}

export interface ProxyResult {
  response: Response;
  proxyReason: string;
}

// Build headers to forward to the upstream server
function buildForwardHeaders(
  targetUrl: URL,
  range?: string | null,
  referer?: string | null,
  clientUA?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": clientUA || "Mozilla/5.0 (compatible; SidebyProxy/1.0)",
    Accept: "*/*",
  };

  // Add range header if provided
  if (range) {
    headers["Range"] = range;
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

  // Priority: embedded headers > referer param > target origin fallback
  const effectiveReferer = embeddedReferer || referer;

  if (effectiveReferer) {
    try {
      new URL(effectiveReferer);
      headers["Referer"] = effectiveReferer;
      headers["Origin"] = embeddedOrigin || new URL(effectiveReferer).origin;
    } catch {
      headers["Referer"] = `${targetUrl.origin}/`;
      headers["Origin"] = targetUrl.origin;
    }
  } else {
    headers["Referer"] = `${targetUrl.origin}/`;
    headers["Origin"] = targetUrl.origin;
  }

  return headers;
}

// Validate the referer parameter for SSRF protection
async function getSafeReferer(
  rawReferer: string | null,
  target: URL
): Promise<string | null> {
  if (!rawReferer) return null;

  try {
    const refUrl = new URL(rawReferer);
    const validation = await validateURL(refUrl);
    if (!validation.valid) return null;
    return refUrl.toString();
  } catch {
    return null;
  }
}

// Perform the upstream fetch with retry logic
async function fetchUpstream(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<Response> {
  const doFetch = (useRange: boolean) => {
    const reqHeaders = { ...headers };
    if (!useRange) delete reqHeaders["Range"];
    return fetch(url, { headers: reqHeaders, redirect: "follow", signal });
  };

  // First attempt with range if provided
  let response = await doFetch(!!headers["Range"]);

  // Retry without Range if 403 (some WAFs block mid-file byte ranges)
  if (response.status === 403 && headers["Range"]) {
    response = await doFetch(false);
  }

  // Retry with minimal headers if blocked
  if ([401, 403, 502, 503, 504].includes(response.status)) {
    response = await fetch(url, {
      headers: { "User-Agent": headers["User-Agent"], Accept: "*/*" },
      redirect: "follow",
      signal,
    });
  }

  return response;
}

// Create CORS headers for the response
function createCORSHeaders(
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

// Handle the video proxy request
export async function handleProxy(
  request: Request,
  config: ProxyConfig
): Promise<ProxyResult> {
  const url = new URL(request.url);
  const targetParam = url.searchParams.get("url");
  const origin = request.headers.get("Origin");

  // Missing URL parameter
  if (!targetParam) {
    return {
      response: Response.json(
        { error: "Missing url parameter" },
        { status: 400 }
      ),
      proxyReason: "missing-param",
    };
  }

  // Parse target URL
  let targetUrl: URL;
  try {
    targetUrl = new URL(targetParam);
  } catch {
    return {
      response: Response.json({ error: "Invalid URL" }, { status: 400 }),
      proxyReason: "invalid-url",
    };
  }

  // SSRF validation
  const validation = await validateURL(targetUrl, config.trustedHosts);
  if (!validation.valid) {
    return {
      response: Response.json(
        { error: "Invalid or disallowed URL", detail: validation.error },
        { status: 400 }
      ),
      proxyReason: "ssrf-blocked",
    };
  }

  // Get safe referer
  const refererParam = url.searchParams.get("referer");

  // Get User-Agent
  const clientUA = request.headers.get("User-Agent");

  // Build forward headers
  const range = request.headers.get("Range");
  const forwardHeaders = buildForwardHeaders(
    targetUrl,
    range,
    refererParam,
    clientUA
  );

  // Fetch upstream
  let upstream: Response;
  try {
    upstream = await fetchUpstream(
      targetUrl.toString(),
      forwardHeaders,
      request.signal
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown fetch error";
    console.error(
      "[proxy] Fetch error:",
      message,
      "URL:",
      targetUrl.toString().slice(0, 200)
    );
    return {
      response: Response.json(
        { error: "Failed to fetch upstream video", detail: message },
        { status: 502, headers: { "x-proxy-reason": "fetch-error" } }
      ),
      proxyReason: "fetch-error",
    };
  }

  // Check response status
  if (!upstream.ok && upstream.status !== 206) {
    const headers = new Headers(
      createCORSHeaders(origin, config.allowedOrigins)
    );
    headers.set("x-proxy-reason", "upstream-error");
    headers.set("x-proxy-origin-status", String(upstream.status));
    return {
      response: new Response(upstream.body, {
        status: upstream.status,
        headers,
      }),
      proxyReason: "upstream-error",
    };
  }

  // Prepare response headers
  const responseHeaders = new Headers(
    createCORSHeaders(origin, config.allowedOrigins)
  );
  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";
  responseHeaders.set("Content-Type", contentType);

  // Check content length limit
  const contentLengthHeader = upstream.headers.get("content-length");
  if (contentLengthHeader) {
    const cl = parseInt(contentLengthHeader, 10);
    if (!isNaN(cl) && cl > config.maxContentLength) {
      return {
        response: Response.json(
          { error: "File too large" },
          { status: 413, headers: { "x-proxy-reason": "size-limit" } }
        ),
        proxyReason: "size-limit",
      };
    }
  }

  // Handle M3U8 rewriting
  if (isM3U8ContentType(contentType, targetUrl.pathname)) {
    try {
      const manifestText = await upstream.text();
      const rewritten = rewriteM3U8(
        manifestText,
        targetUrl,
        config.proxyBaseUrl
      );

      responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
      responseHeaders.set(
        "Cache-Control",
        upstream.headers.get("cache-control") || "public, max-age=300"
      );
      responseHeaders.set("x-proxy-reason", "m3u8-rewrite");

      return {
        response: new Response(rewritten, {
          status: upstream.status === 206 ? 200 : upstream.status,
          headers: responseHeaders,
        }),
        proxyReason: "m3u8-rewrite",
      };
    } catch (error) {
      console.error("[proxy] M3U8 rewrite failed:", error);
    }
  }

  // Set cache and range headers
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) responseHeaders.set("Accept-Ranges", acceptRanges);
  responseHeaders.set(
    "Cache-Control",
    upstream.headers.get("cache-control") || "public, max-age=3600"
  );

  // Handle range synthesis (when upstream returns 200 but client requested range)
  if (
    range &&
    upstream.status === 200 &&
    acceptRanges?.includes("bytes") &&
    upstream.body
  ) {
    const rangeMatch = range.match(/bytes=(\d+)-(\d+)?/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = rangeMatch[2]
        ? parseInt(rangeMatch[2], 10)
        : start + 1024 * 1024 - 1;
      const chunkSize = end - start + 1;

      if (chunkSize > 0 && chunkSize <= 8 * 1024 * 1024) {
        const reader = upstream.body.getReader();
        let offset = 0;
        let collected = 0;

        const stream = new ReadableStream({
          async pull(controller) {
            while (collected < chunkSize) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!value) continue;

              const valEnd = offset + value.length;
              if (valEnd > start && offset <= end) {
                const sliceStart = Math.max(0, start - offset);
                const sliceEnd = Math.min(value.length, end - offset + 1);
                const slice = value.subarray(sliceStart, sliceEnd);
                collected += slice.length;
                controller.enqueue(slice);
                if (collected >= chunkSize) break;
              }
              offset = valEnd;
              if (offset > end) break;
            }
            controller.close();
          },
        });

        responseHeaders.set(
          "Content-Range",
          `bytes ${start}-${start + chunkSize - 1}/${
            contentLengthHeader || "*"
          }`
        );
        responseHeaders.set("x-proxy-reason", "range-synthesized");

        return {
          response: new Response(stream, {
            status: 206,
            headers: responseHeaders,
          }),
          proxyReason: "range-synthesized",
        };
      }
    }
  }

  // Pass-through
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) responseHeaders.set("Content-Range", contentRange);
  responseHeaders.set("x-proxy-reason", "pass-through");

  return {
    response: new Response(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers: responseHeaders,
    }),
    proxyReason: "pass-through",
  };
}
