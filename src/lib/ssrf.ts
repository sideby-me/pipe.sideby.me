// SSRF Protection utilities for Cloudflare Workers
import { logger } from "./logger";

// Private IP ranges (IPv4)
const PRIVATE_IPV4_RANGES = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] }, // 10.0.0.0/8
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] }, // 172.16.0.0/12
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] }, // 192.168.0.0/16
  { start: [127, 0, 0, 0], end: [127, 255, 255, 255] }, // 127.0.0.0/8 (loopback)
  { start: [169, 254, 0, 0], end: [169, 254, 255, 255] }, // 169.254.0.0/16 (link-local)
  { start: [0, 0, 0, 0], end: [0, 0, 0, 0] }, // 0.0.0.0
];

// Disallowed hostname patterns
const DISALLOWED_HOST_PATTERNS = [
  /^localhost$/i,
  /^ip6-localhost$/i,
  /\.local$/i,
];

// Parse an IPv4 address string into an array of 4 octets
function parseIPv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255 || part !== String(num)) return null;
    octets.push(num);
  }
  return octets;
}

// Check if an IPv4 address is within a range
function isInRange(ip: number[], start: number[], end: number[]): boolean {
  for (let i = 0; i < 4; i++) {
    if (ip[i] < start[i]) return false;
    if (ip[i] > end[i]) return false;
  }
  return true;
}

// Check if an IP address is private/internal (should be blocked)
export function isPrivateIP(address: string): boolean {
  // Handle IPv6 loopback
  if (
    address === "::1" ||
    address === "::" ||
    address.toLowerCase().startsWith("fe80:")
  ) {
    return true;
  }

  // Handle IPv6 unique local (fc00::/7)
  const lowerAddr = address.toLowerCase();
  if (lowerAddr.startsWith("fc") || lowerAddr.startsWith("fd")) {
    return true;
  }

  // Parse IPv4
  const octets = parseIPv4(address);
  if (!octets) return false; // Can't parse, let fetch handle it

  // Check against private ranges
  for (const range of PRIVATE_IPV4_RANGES) {
    if (isInRange(octets, range.start, range.end)) {
      return true;
    }
  }

  return false;
}

// Check if an IP string is a valid IP address (v4 or v6)
export function isIP(address: string): boolean {
  // IPv4 check
  if (parseIPv4(address)) return true;

  // Simple IPv6 check (contains colons, valid hex chars)
  if (address.includes(":") && /^[0-9a-fA-F:]+$/.test(address)) {
    return true;
  }

  return false;
}

// Check if a hostname matches disallowed patterns
export function isHostnameDisallowed(hostname: string): boolean {
  if (hostname === "0.0.0.0") return true;
  return DISALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

interface DoHResponse {
  Answer?: Array<{
    type: number;
    data: string;
  }>;
}

// Resolve hostname to IP addresses using DNS-over-HTTPS
export async function resolveDNS(hostname: string): Promise<string[]> {
  try {
    // Query both A (IPv4) and AAAA (IPv6) records
    const [aResponse, aaaaResponse] = await Promise.all([
      fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
          hostname
        )}&type=A`,
        {
          headers: { Accept: "application/dns-json" },
        }
      ),
      fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
          hostname
        )}&type=AAAA`,
        {
          headers: { Accept: "application/dns-json" },
        }
      ),
    ]);

    const addresses: string[] = [];

    if (aResponse.ok) {
      const aData: DoHResponse = await aResponse.json();
      if (aData.Answer) {
        for (const answer of aData.Answer) {
          if (answer.type === 1) {
            // A record
            addresses.push(answer.data);
          }
        }
      }
    }

    if (aaaaResponse.ok) {
      const aaaaData: DoHResponse = await aaaaResponse.json();
      if (aaaaData.Answer) {
        for (const answer of aaaaData.Answer) {
          if (answer.type === 28) {
            // AAAA record
            addresses.push(answer.data);
          }
        }
      }
    }

    return addresses;
  } catch (error) {
    logger.error("DoH resolution failed", { error: String(error) });
    return [];
  }
}

// Check if a hostname is in the trusted list (suffix match)
function isTrustedHost(hostname: string, trustedHosts?: string[]): boolean {
  if (!trustedHosts || trustedHosts.length === 0) return false;
  const lowerHost = hostname.toLowerCase();
  return trustedHosts.some((trusted) => {
    const lowerTrusted = trusted.toLowerCase();
    return lowerHost === lowerTrusted || lowerHost.endsWith("." + lowerTrusted);
  });
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Validate a URL for SSRF protection
export async function validateURL(
  url: URL,
  trustedHosts?: string[]
): Promise<ValidationResult> {
  // Protocol check
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valid: false, error: "Invalid protocol" };
  }

  const hostname = url.hostname;

  // Hostname pattern check
  if (isHostnameDisallowed(hostname)) {
    return { valid: false, error: "Disallowed hostname" };
  }

  // If it's a direct IP, validate immediately
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      return { valid: false, error: "Private IP address" };
    }
    return { valid: true };
  }

  // Resolve DNS and check all addresses
  const addresses = await resolveDNS(hostname);

  if (addresses.length === 0) {
    if (isTrustedHost(hostname, trustedHosts)) {
      logger.warn(`Trusted host DNS soft-fail: ${hostname}`, {
        path: url.pathname,
      });
      return { valid: true };
    }
    return { valid: false, error: "DNS resolution failed" };
  }

  // Reject if ANY resolved address is private (prevents DNS rebinding)
  for (const addr of addresses) {
    if (isPrivateIP(addr)) {
      return { valid: false, error: "Resolved to private IP" };
    }
  }

  return { valid: true };
}
