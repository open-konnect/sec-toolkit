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
│   ├── _redirects            # Cloudflare Pages SPA client-side routing
│   └── robots.txt            # Search engine crawler instructions
├── src/
│   ├── app/
│   │   ├── App.tsx           # Router provider and app entry point
│   │   └── routes.tsx        # Dynamic route dispatcher & scroll restoration
│   ├── components/
│   │   ├── layout/           # Navbar (with category nav), Footer, Layout wrapper
│   │   ├── tool/             # ToolHeader, ToolCard, Breadcrumbs, RelatedTools, SecurityFinding, SEOHead
│   │   └── ui/               # CopyButton, ClearButton, CodeBlock, ErrorMessage, WarningMessage, AdSlot
│   ├── lib/
│   │   ├── analytics/        # Privacy-first pluggable analytics (no-op by default)
│   │   ├── formatting/       # Clipboard copy, timestamp helpers
│   │   └── security/         # Safe parsers, input size validation, safeBase64Encode
│   ├── pages/
│   │   ├── HomePage.tsx      # Featured tools, category filter (?category=), search
│   │   ├── ToolPage.tsx      # Dynamic tool renderer with Breadcrumbs + RelatedTools + SEO
│   │   └── NotFoundPage.tsx  # 404 handler
│   ├── tools/
│   │   ├── registry.ts       # REGISTERED_TOOLS array + getFeaturedTools(), getToolById(), getRelatedTools()
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
├── tests/                    # Unit tests for all 15 tools' logic functions
├── AGENT.md                  # Full architecture guide for AI coding agents
├── CLAUDE.md                 # Quick-reference for AI assistants
├── package.json
└── vite.config.ts
```

---

## 🚀 How to Add a New Tool

The tool registry architecture allows future developer, security, data, and AI utilities to be added cleanly without refactoring routing, navigation, or shared layouts.

1. **Create `src/tools/<tool-slug>/`** with `types.ts`, `logic/`, `components/`, `metadata.ts`, and `index.ts`
2. **Implement pure logic** in `logic/` (no React — makes it unit-testable)
3. **Define metadata** in `metadata.ts` (name, route, SEO, category, keywords)
4. **Register** in `src/tools/registry.ts` → `REGISTERED_TOOLS`
5. **Write tests** in `tests/<tool-slug>.test.ts`
6. **Verify**: `npm test` and `npm run build` must both pass

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

The production output will be generated in the `dist/` directory.

---

## ☁️ Deployment: GitHub → Cloudflare Pages

This project requires **zero backend servers**, databases, or container infrastructure.

**Cloudflare Pages Build Settings:**
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Build Output Directory**: `dist`

> The `public/_redirects` file automatically handles SPA routing (`/* /index.html 200`), enabling direct link access to any tool URL.

---

## 📈 Future Architecture Extension Points

- **AdSlot**: An `AdSlot` component is placed in the layout, completely disabled (`ADS_ENABLED = false`) in v1. Enable non-intrusive ads at this single extension point.
- **Premium Features**: The modular registry allows future capabilities (saved history, offline PWA, team workspaces) to be added incrementally.

---

## 📄 License

MIT License. Free for developers, teams, and security researchers.
