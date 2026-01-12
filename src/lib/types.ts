export type ProxyReason =
  | "pass-through"
  | "m3u8-rewrite"
  | "range-synthesized"
  | "origin-blocked"
  | "missing-param"
  | "invalid-url"
  | "ssrf-blocked"
  | "fetch-error"
  | "upstream-error"
  | "size-limit";

export interface LogEvent {
  level: "info" | "warn" | "error";
  service: "pipe";
  message: string;
  proxyReason?: ProxyReason;
  [key: string]: unknown;
}
