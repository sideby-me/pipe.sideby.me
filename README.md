# `Sideby Pipe`

A Cloudflare Worker that proxies video streams for Sideby.me. Handles CORS, HLS manifest rewriting, and range requests, all at the edge.

## What it does

TL;DR:

- Proxies video streams (mp4, HLS/m3u8) for cross-origin playback
- Rewrites HLS manifests to route segments through the proxy
- SSRF protection via DNS-over-HTTPS validation
- Range request synthesis for seeking support
- CORS headers for the main app

## Getting Started

### Prerequisites

- [`Node.js 18+`](https://nodejs.org/en)
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (for deployment)

### Running it Locally

**1. Install dependencies**

```bash
npm install
```

**2. Start the dev server**

```bash
npm run dev
```

This starts wrangler on `http://localhost:8787`.

**3. Test it**

```bash
curl "http://localhost:8787/?url=https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
```

### Deployment

```bash
npm run deploy
```

Then configure `pipe.sideby.me` as a custom domain in your Cloudflare dashboard.

### Available Scripts

```bash
npm run dev      # Start local dev server
npm run deploy   # Deploy to Cloudflare
npm run tail     # View live logs
npm run format   # Prettier format
```

## Project Structure

```
├── src/
│   ├── index.ts           # Worker entry point
│   └── lib/
│       ├── proxy.ts       # Core proxy logic
│       ├── ssrf.ts        # SSRF protection (DoH + IP validation)
│       └── m3u8.ts        # HLS manifest rewriting
├── wrangler.toml          # Cloudflare config
└── package.json
```

## How It Works

1. **Request comes in** with `?url=<target>`
2. **SSRF validation** — DNS lookup via DoH, reject private IPs
3. **Fetch upstream** — with retry logic for WAF/hotlink protection
4. **HLS handling** — rewrite manifest URLs to proxy segments
5. **Range synthesis** — slice streams for seeking support
6. **Response** — with CORS headers for the main app

## Contributing

If you find ways to make improvements (or find bugs), feel free to open an issue or a pull request :/
