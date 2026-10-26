# Developer Security Toolkit

> 15 free, fast, privacy-first developer and security utilities that run 100% in your browser.

A production-grade, extensible web application providing client-side security and developer utilities. Built with **React**, **TypeScript**, **Vite**, and **Tailwind CSS**, designed for zero-backend deployment directly to **Cloudflare Pages**.

---

## 🔒 Privacy Model & Security Guarantee

All data processing happens **locally inside the user's browser**:

- **No Remote Transmission**: Your tokens, Base64 strings, generated keys, and passwords are never transmitted to any server or API.
- **Zero Input Logging**: No user input is ever written to telemetry, analytics, cookies, or remote storage.
- **Client-Side Cryptography**: Cryptographic operations rely strictly on the native Web Cryptography API (`crypto.subtle`, `crypto.randomUUID()`, `crypto.getRandomValues()`).
- **Safe Parsing Guards**: Input size limits (512 KB safe client threshold) prevent browser freezing or runaway memory consumption on malformed inputs.
- **No Unsafe HTML Injection**: All JSON and token data is rendered as structured React components, completely avoiding `dangerouslySetInnerHTML` or `eval()`.

> **Guarantee:** Your data stays in your browser. These tools process your input locally and do not upload it.

---

## 🛠 Available Tools

### 🔐 Security

| Tool | Route | Description |
|------|-------|-------------|
| JWT Decoder & Security Analyzer | `/jwt-decoder` | Decode JWT tokens and run automated security heuristics (alg:none, expiry, lifetime, etc.) |
| Hash Generator | `/hash-generator` | SHA-256, SHA-384, SHA-512 (and SHA-1 with warnings) via browser-native `crypto.subtle` |
| JWT Generator | `/jwt-generator` | Create HMAC-signed JWTs (HS256/384/512) entirely in-browser |
| CSP Generator | `/csp-generator` | Build Content Security Policy headers with security audit warnings |
| Security Headers | `/security-headers` | Configure HSTS, X-Frame-Options, COOP, CORP — export for Nginx/Apache/Cloudflare |
| Password Strength | `/password-strength` | Entropy analysis and pattern detection — passwords never leave your browser |

### 📋 Encoding

| Tool | Route | Description |
|------|-------|-------------|
| Base64 Encoder / Decoder | `/base64` | Bi-directional Base64 and Base64URL with true UTF-8 support |
| URL Encoder / Decoder | `/url-encoder` | Full URL and component encode/decode with graceful malformed-input handling |

### ⚙️ Developer

| Tool | Route | Description |
|------|-------|-------------|
| UUID Generator | `/uuid-generator` | RFC 4122 v4 UUIDs via `crypto.randomUUID()` — single, bulk, and validator |
| Timestamp Converter | `/timestamp-converter` | Convert between Unix epochs, ISO 8601, UTC, and local time bidirectionally |
| Regex Tester | `/regex-tester` | Test patterns with match highlighting, capture groups, replace mode, and preset patterns |
| Cron Expression Generator | `/cron-generator` | Visual cron schedule builder with human-readable descriptions and next-run preview |

### 📊 Data

| Tool | Route | Description |
|------|-------|-------------|
| JSON Formatter & Validator | `/json-formatter` | Prettify, minify, and validate JSON with error location hints |
| JSON → TypeScript | `/json-to-typescript` | Infer TypeScript interfaces and types from JSON payloads |

### 🤖 AI

| Tool | Route | Description |
|------|-------|-------------|
| LLM Token Calculator | `/llm-token-calculator` | Estimate token counts and API costs for 6 popular LLM model presets |

---

## 🏗 Modular Architecture

The application is architected around an isolated **Tool Registry pattern**. Individual utilities reside in self-contained folders with their own logic, types, components, and SEO metadata.

```text
sec-toolkit/
├── public/
│   └── og-image.png          # 1200×630 social sharing image (og-image.svg is the source)
├── scripts/
│   └── generate-seo.mjs      # Prerenders route HTML, sitemap.xml, robots.txt, preview headers
├── src/
│   ├── app/
│   │   ├── App.tsx           # Router provider and app entry point
│   │   └── routes.tsx        # Explicit home, category, tool, and 404 routes
│   ├── components/
│   │   ├── layout/           # Navbar (with category nav), Footer, Layout wrapper
│   │   ├── tool/             # ToolHeader, ToolCard, Breadcrumbs, RelatedTools, EducationalSection, SEOHead
│   │   └── ui/               # CopyButton, ClearButton, CodeBlock, ErrorMessage, WarningMessage, AdSlot
│   ├── lib/
│   │   ├── analytics/        # Privacy-first pluggable analytics (no-op by default)
│   │   ├── formatting/       # Clipboard copy, timestamp helpers
│   │   └── security/         # Safe parsers, input size validation, safeBase64Encode
│   ├── pages/
│   │   ├── HomePage.tsx      # Tool directory, search, featured tools, privacy overview
│   │   ├── CategoryPage.tsx  # /security, /encoding, /data, /developer, /ai landing pages
│   │   ├── ToolPage.tsx      # Tool shell with breadcrumbs, related tools, docs, and lazy-loaded UI
│   │   └── NotFoundPage.tsx  # noindex 404 page
│   ├── seo/
│   │   ├── config.ts         # Canonical origin, indexability rules, path normalization
│   │   ├── pages.ts          # Single source of truth for titles, descriptions, breadcrumbs, FAQs
│   │   ├── head.ts           # Open Graph, Twitter, canonical, robots, JSON-LD generation
│   │   └── prerender.tsx     # SSR entry used by the build to render every route
│   ├── tools/
│   │   ├── registry.ts       # REGISTERED_TOOLS, categories, related tools, search
│   │   ├── jwt/              # JWT Decoder module
│   │   ├── base64/           # Base64 Converter module
│   │   ├── uuid/             # UUID Generator module
│   │   ├── json-formatter/   # JSON Formatter & Validator
│   │   ├── hash-generator/   # Hash Generator (async crypto.subtle)
│   │   ├── url-encoder/      # URL Encoder / Decoder
│   │   ├── timestamp-converter/ # Timestamp Converter
│   │   ├── regex-tester/     # Regex Tester
│   │   ├── cron-generator/   # Cron Expression Generator
│   │   ├── jwt-generator/    # JWT Generator (async crypto.subtle)
│   │   ├── json-to-typescript/ # JSON → TypeScript
│   │   ├── csp-generator/    # CSP Generator
│   │   ├── security-headers/ # Security Headers
│   │   ├── password-strength/ # Password Strength Analyzer
│   │   └── llm-token-calculator/ # LLM Token Calculator
│   └── types/
│       └── index.ts          # ToolDefinition, ToolCategory and shared types
├── tests/                    # Unit tests for all 15 tools plus SEO regression tests
├── .env.example              # Documented public SEO configuration variables
├── AGENT.md                  # Full architecture guide for AI coding agents
├── CLAUDE.md                 # Quick-reference for AI assistants
├── package.json
└── vite.config.ts
```

---

## 🔎 SEO & Prerendering

Every public route is rendered to static HTML at build time, so crawlers receive the full title, meta description, canonical URL, breadcrumbs, documentation, FAQ text, and related-tool links without executing JavaScript. The interactive tool still hydrates and runs entirely in the browser.

The build generates:

- `dist/index.html` for the home page
- `dist/security.html`, `encoding.html`, `data.html`, `developer.html`, and `ai.html` for category pages
- one HTML file per tool, such as `dist/jwt-decoder.html` and `dist/base64.html`
- `dist/404.html` with `noindex`
- `dist/sitemap.xml` with all 21 indexable URLs
- `dist/robots.txt` pointing at the sitemap

Tool and category metadata remains in `src/tools/*/metadata.ts` and `src/tools/registry.ts`. `src/seo/pages.ts` derives page SEO, breadcrumbs, related links, and structured data from that registry, so new tools automatically appear in the sitemap and prerender pipeline.

### Structured data

Pages emit truthful JSON-LD only:

- `WebSite` on the home page
- `CollectionPage` + `ItemList` on category pages
- `WebApplication` on tool pages
- `BreadcrumbList` on category and tool pages
- `FAQPage` where visible FAQ content exists

No ratings, reviews, prices, or claims are fabricated.

### Configuration

Copy the example file and set values for your deployment:

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SITE_URL` | Recommended | Production origin used for canonicals, Open Graph URLs, and `sitemap.xml`. Use the custom domain, not a preview hostname. Defaults to `https://securitytoolkit.dev`. |
| `VITE_OG_IMAGE` | Optional | Social image path or absolute URL. Defaults to `/og-image.png`. |
| `VITE_TWITTER_HANDLE` | Optional | Twitter/X handle, including `@`, added as `twitter:site`. |
| `VITE_GOOGLE_SITE_VERIFICATION` | Optional | Google Search Console HTML-tag verification value (the `content` value only). |
| `VITE_NOINDEX` | Preview only | Set to `true` for preview/staging builds to emit `noindex` metadata, a disallow-all `robots.txt`, and `X-Robots-Tag` headers. Never set this for production. |

The client also refuses to index non-production hostnames such as `localhost` and `*.pages.dev`, so an accidental preview deployment does not compete with the canonical domain even if `VITE_NOINDEX` is omitted.

Set `VITE_SITE_URL` to the exact origin users will visit, including the `www` or apex hostname you intend to keep. The client-side indexability guard only allows that hostname, so redirect the alternate hostname to it in Cloudflare rather than serving the same build on both.

---

## 🚀 How to Add a New Tool

The tool registry architecture allows future developer, security, data, and AI utilities to be added cleanly without refactoring routing, navigation, or shared layouts.

1. **Create `src/tools/<tool-slug>/`** with `types.ts`, `logic/`, `components/`, `metadata.ts`, and `index.ts`
2. **Implement pure logic** in `logic/` (no React — makes it unit-testable)
3. **Define metadata** in `metadata.ts` (name, route, SEO title/description, category, keywords, related tools, educational content, FAQs)
4. **Register** in `src/tools/registry.ts` → `REGISTERED_TOOLS`
5. **Add the explicit route** in `src/app/routes.tsx`
6. **Write tests** in `tests/<tool-slug>.test.ts`
7. **Verify**: `npm test` and `npm run build` must both pass. The new route should appear in `dist/sitemap.xml` and render static HTML.

See [`AGENT.md`](./AGENT.md) for full step-by-step instructions, type definitions, and coding guidelines.

---

## 💻 Local Development

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Setup & Run
```bash
# Clone the repository
git clone https://github.com/your-username/sec-toolkit.git
cd sec-toolkit

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🧪 Testing

Run automated unit tests for all core algorithmic logic:

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 📦 Building for Production

```bash
npm run build
```

The build runs four steps:

1. `tsc` type-check
2. `vite build` for the client bundle
3. `vite build --ssr src/seo/prerender.tsx` for the prerender bundle
4. `node scripts/generate-seo.mjs` to write static HTML for every route, `sitemap.xml`, `robots.txt`, `404.html`, and preview headers when requested

The production output is generated in `dist/`.

### Verify the generated output locally

```bash
npm run preview
```

Check `dist/sitemap.xml`, `dist/robots.txt`, and a tool page such as `dist/jwt-decoder.html`. Confirm the page contains one `<h1>`, a self-referencing canonical, `index, follow`, visible documentation, and JSON-LD.

---

## ☁️ Deployment: GitHub → Cloudflare Pages

This project requires **zero backend servers**, databases, or container infrastructure.

**Cloudflare Pages Build Settings:**
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Build Output Directory**: `dist`
- **Production branch**: `main` (or your chosen branch)
- **Environment variables**: set `VITE_SITE_URL` to your custom domain

Cloudflare Pages serves `dist/<slug>.html` at the extensionless URL `/<slug>` and redirects `.html` requests to the extensionless form. The build therefore writes real HTML files instead of relying on an SPA fallback rewrite. Do **not** add a `/* /index.html 200` `_redirects` rule: it would serve the home page for every tool URL and hide the prerendered pages from crawlers.

`dist/404.html` is used automatically for unknown paths. The production `dist/robots.txt` allows crawling and references the sitemap.

### Custom domain and Search Console

1. Add the custom domain in **Cloudflare Pages → Custom domains** and wait for DNS/SSL to become active.
2. Set `VITE_SITE_URL` to that exact origin, including `https://` and without a trailing slash, then redeploy.
3. Open `https://your-domain/sitemap.xml` and confirm all 21 URLs use the custom domain.
4. In [Google Search Console](https://search.google.com/search-console), add a **URL-prefix** or **Domain** property, complete verification, and submit `https://your-domain/sitemap.xml`.
5. Use **URL Inspection** on the home page and a few tool pages, then request indexing.
6. In Bing Webmaster Tools, add the site and submit the same sitemap.
7. Optionally set `VITE_GOOGLE_SITE_VERIFICATION` to the Search Console HTML-tag value and redeploy instead of using DNS verification.

### Preview deployments

Cloudflare preview URLs look like `<branch>.<project>.pages.dev`. They are useful for review but should never be indexed. Set `VITE_NOINDEX=true` for preview builds (Cloudflare allows per-environment variables) so the build emits:

- `<meta name="robots" content="noindex, nofollow">`
- a disallow-all `robots.txt`
- an `X-Robots-Tag` header in `dist/_headers`

Leave `VITE_NOINDEX` unset for the production branch. Even without it, the client-side indexability guard refuses to index `localhost` and `*.pages.dev`, but `VITE_NOINDEX=true` also protects the static HTML before JavaScript runs.

---

## 📈 Future Architecture Extension Points

- **AdSlot**: An `AdSlot` component is placed in the layout, completely disabled (`ADS_ENABLED = false`) in v1. Enable non-intrusive ads at this single extension point.
- **Premium Features**: The modular registry allows future capabilities (saved history, offline PWA, team workspaces) to be added incrementally.

---

## 📄 License

MIT License. Free for developers, teams, and security researchers.
