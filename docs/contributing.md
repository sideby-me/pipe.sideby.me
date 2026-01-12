# Contributing to pipe.sideby.me

This guide explains how to work on the pipe.sideby.me worker.

## Before You Start

- Run the worker locally (see `local-development.md`).
- Skim the architecture and file structure docs in this folder.

## Where to Put Things

- **Proxy logic** (fetch strategies, retry behavior, range handling):
  - Update `src/lib/proxy.ts`.
- **SSRF protection** (IP validation, DNS resolution):
  - Update `src/lib/ssrf.ts`.
- **HLS handling** (manifest parsing, URL rewriting):
  - Update `src/lib/m3u8.ts`.
- **Header spoofing** (User-Agent, Referer patterns):
  - Update `src/lib/headers.ts`.
- **CORS and origin validation**:
  - Update `src/lib/cors.ts` and `src/index.ts`.
- **Configuration and environment**:
  - Update `src/lib/config.ts` and `wrangler.toml`.

## Coding Conventions

- Use TypeScript with strict mode enabled.
- Export types from `src/lib/types.ts`.
- Use the `logger` helper for all logging.
- Keep functions focused; prefer small, testable units.

## Testing

- Test common cases locally with curl.
- Test edge cases:
  - Private IPs (SSRF block).
  - HLS manifests with relative URLs.
  - Range requests against servers that don't support them.
  - 403 retries with alternate headers.

## Deployment

After testing locally:

```bash
npm run deploy
```

Then configure `pipe.sideby.me` as a custom domain in the Cloudflare dashboard if not already done.

## Submitting Changes

- Keep PRs focused on a single concern.
- Update docs in this folder when adding new behavior.
- Verify that the worker still starts and proxies successfully.
