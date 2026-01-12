# Security: SSRF Protection

This guide explains how pipe.sideby.me guards against Server-Side Request Forgery (SSRF).

## The Risk

Without protection, an attacker could use the proxy to:

- Scan internal networks (e.g., `http://192.168.1.1/admin`).
- Access cloud metadata endpoints (e.g., `http://169.254.169.254/`).
- Abuse the worker's egress IP for attacks.

## DNS-over-HTTPS Validation

Before fetching any target URL, `validateUrl` in `ssrf.ts`:

1. Parses the URL and extracts the hostname.
2. Performs a DNS lookup via Cloudflare's DoH endpoint (`https://1.1.1.1/dns-query`) to resolve the hostname to IP addresses.
3. Checks each resolved IP against a blocklist of private/internal ranges:
   - `10.0.0.0/8`
   - `172.16.0.0/12`
   - `192.168.0.0/16`
   - `127.0.0.0/8` (loopback)
   - `169.254.0.0/16` (link-local)
   - `::1`, `fc00::/7`, `fe80::/10` (IPv6 equivalents)
4. If any resolved IP is private, the request is rejected with a 403.

## Why DoH?

Using DNS-over-HTTPS instead of native DNS:

- Avoids DNS rebinding attacks where a hostname initially resolves to a public IP but later resolves to a private IP.
- Provides consistent behavior across Cloudflare's edge, which may not have access to system DNS.

## Additional Safeguards

- **Scheme validation** — Only `http` and `https` schemes are allowed.
- **Origin allowlist** — Requests must originate from allowed origins (configured via environment), blocking direct abuse from unknown sources.
