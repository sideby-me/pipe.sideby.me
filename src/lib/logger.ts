import { LogEvent, ProxyReason } from "./types";

export function logEvent(
  level: LogEvent["level"],
  message: string,
  extras: Record<string, unknown> & { proxyReason?: ProxyReason } = {}
) {
  const payload: LogEvent = {
    level,
    service: "pipe",
    message,
    ts: Date.now(),
    ...extras,
  };

  // Use console.error for errors to trigger Cloudflare error reporting if active,
  // otherwise console.log for structured logs.
  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

export const logger = {
  info: (message: string, extras?: Record<string, unknown>) =>
    logEvent("info", message, extras),
  warn: (message: string, extras?: Record<string, unknown>) =>
    logEvent("warn", message, extras),
  error: (message: string, extras?: Record<string, unknown>) =>
    logEvent("error", message, extras),
};
