# Local Development

This guide explains how to develop and test pipe.sideby.me locally.

## Prerequisites

- Node.js 18+
- npm (comes with Node.js)
- A Cloudflare account (for deployment, not required for local dev)

## Setup

1. Clone the repository and navigate to the `pipe.sideby.me` folder.
2. Install dependencies:
   ```bash
   npm install
   ```

## Running Locally

Start the Wrangler dev server:

```bash
npm run dev
```

This starts the worker on `http://localhost:8787`.

## Testing

Test the proxy with curl:

```bash
curl "http://localhost:8787/?url=https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
```

You should receive the HLS manifest with segment URLs rewritten to route through `localhost:8787`.

### Testing Origin Validation

By default, the local dev server may bypass origin checks. To test origin behavior:

```bash
curl -H "Origin: https://sideby.me" "http://localhost:8787/?url=..."
```

### Testing SSRF Protection

Attempting to proxy a private IP should return 403:

```bash
curl "http://localhost:8787/?url=http://192.168.1.1/"
# Expected: 403 Forbidden
```

## Available Scripts

| Script           | Description                         |
| ---------------- | ----------------------------------- |
| `npm run dev`    | Start local dev server on port 8787 |
| `npm run deploy` | Deploy to Cloudflare Workers        |
| `npm run tail`   | View live logs from production      |
| `npm run format` | Format code with Prettier           |

## Debugging

- Console logs appear in the terminal running `npm run dev`.
- Use `logger.info`, `logger.warn`, `logger.error` from `src/lib/logger.ts`.
- For production debugging, use `npm run tail` to stream live logs.
