# AGENT.md — Developer Security Toolkit Instructions & Architecture Guide

Welcome, AI coding assistant or autonomous agent. This document provides complete project context, architectural guidelines, directory structures, testing standards, and step-by-step instructions for extending the **Developer Security Toolkit**.

---

## 1. Project Overview & Ethos

**Developer Security Toolkit** is an extensible, privacy-first web application providing **15 free developer and security browser-based utilities**.

### Core Ethos & Non-Negotiable Rules:
- **100% Client-Side Processing**: All processing occurs strictly inside the user's browser using native Web APIs (`crypto.subtle`, `crypto.randomUUID()`, `crypto.getRandomValues()`, `TextEncoder`, `TextDecoder`, `JSON.parse`).
- **Zero Data Transmission**: User inputs (tokens, Base64 strings, keys, secrets, passwords) **must never** be uploaded to any server, stored in cookies, or sent to telemetry/analytics.
- **Static Frontend Only**: Built using React, TypeScript, Vite, and Tailwind CSS. Deployable to Cloudflare Pages as a static site (`npm run build` produces `dist/`). Zero backend servers, Express, Docker, Redis, or serverless functions.
- **Defensive Engineering**: Protect against browser freezing and crashes using input size limits (`validateInputSize`) and safe parsers (`safeJsonParse`, `safeBase64Decode`). Never use `eval()` or `dangerouslySetInnerHTML`.

---

## 2. Tech Stack & Commands

- **Language**: TypeScript (strict mode: `noUnusedLocals`, `noUnusedParameters` enabled)
- **Framework**: React 18 + React Router 6
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3 (dark mode enabled by default)
- **Icons**: `lucide-react`
- **Testing**: Vitest 5

### Common CLI Commands:
```bash
# Install dependencies
npm install

# Start local Vite development server (port 5173)
npm run dev

# Run all unit tests (Vitest)
npm test

# Run tests in watch mode
npm run test:watch

# Build production bundle (runs tsc && vite build)
npm run build

# Preview production build locally
npm run preview
```

---

## 3. All 15 Tools

| # | Tool | Route | Category |
|---|------|--------|----------|
| 1 | JWT Decoder & Security Analyzer | `/jwt-decoder` | Security |
| 2 | Base64 Encoder / Decoder | `/base64` | Encoding |
| 3 | UUID Generator | `/uuid-generator` | Developer |
| 4 | JSON Formatter & Validator | `/json-formatter` | Data |
| 5 | Hash Generator | `/hash-generator` | Security |
| 6 | URL Encoder / Decoder | `/url-encoder` | Encoding |
| 7 | Timestamp Converter | `/timestamp-converter` | Developer |
| 8 | Regex Tester | `/regex-tester` | Developer |
| 9 | Cron Expression Generator | `/cron-generator` | Developer |
| 10 | JWT Generator | `/jwt-generator` | Security |
| 11 | JSON → TypeScript Converter | `/json-to-typescript` | Data |
| 12 | CSP Generator | `/csp-generator` | Security |
| 13 | Security Headers Analyzer | `/security-headers` | Security |
| 14 | Password Strength Analyzer | `/password-strength` | Security |
| 15 | LLM Token Calculator | `/llm-token-calculator` | AI |

---

## 4. Project Structure

```text
sec-toolkit/
├── public/
│   └── og-image.png          # Social sharing image (og-image.svg is the source)
├── scripts/
│   └── generate-seo.mjs      # Prerender, sitemap, robots, preview headers
├── src/
│   ├── app/
│   │   ├── App.tsx           # BrowserRouter mount
│   │   └── routes.tsx        # Dynamic route dispatcher & scroll-to-top handler
│   ├── components/
│   │   ├── layout/           # Navbar (with category nav), Footer, Layout wrapper
│   │   ├── tool/             # ToolHeader, ToolCard (with iconName), Breadcrumbs, RelatedTools, SecurityFinding, SEOHead
│   │   └── ui/               # Button, Badge, CodeBlock, CopyButton, ClearButton, JsonViewer, AdSlot, WarningMessage, ErrorMessage
│   ├── lib/
│   │   ├── analytics/        # Privacy-first pluggable analytics interface (no-op by default)
│   │   ├── formatting/       # Timestamp conversions, duration math, clipboard copy
│   │   └── security/         # Safe Base64/JSON parsers, safeBase64Encode, base64ToBase64Url, input size limits
│   ├── pages/
│   │   ├── HomePage.tsx      # Tool directory, featured section, search, privacy guarantee
│   │   ├── CategoryPage.tsx  # Category landing pages (security, encoding, data, developer, ai)
│   │   ├── ToolPage.tsx      # Tool shell with Breadcrumbs, RelatedTools, docs, lazy UI
│   │   └── NotFoundPage.tsx  # noindex 404 handler with quick navigation
│   ├── tools/
│   │   ├── registry.ts       # Central tool registry: REGISTERED_TOOLS, TOOL_CATEGORIES, getFeaturedTools(), getToolById(), getRelatedTools()
│   │   ├── jwt/              # JWT Decoder & Analyzer (components, logic, types, metadata)
│   │   ├── base64/           # Base64 Converter (components, logic, types, metadata)
│   │   ├── uuid/             # UUID Generator (components, logic, types, metadata)
│   │   ├── json-formatter/   # JSON Formatter & Validator (components, logic, types, metadata)
│   │   ├── hash-generator/   # Hash Generator — SHA-256/384/512/SHA-1 via crypto.subtle (async)
│   │   ├── url-encoder/      # URL Encoder / Decoder (URI + component modes)
│   │   ├── timestamp-converter/ # Epoch ↔ Date, ISO 8601, UTC, local time
│   │   ├── regex-tester/     # Regex match, capture groups, replace mode, preset patterns
│   │   ├── cron-generator/   # Visual cron builder, human description, next-run preview
│   │   ├── jwt-generator/    # HMAC HS256/384/512 JWT signing via crypto.subtle (async)
│   │   ├── json-to-typescript/ # JSON → TypeScript interface/type inference
│   │   ├── csp-generator/    # CSP header builder with security audit warnings
│   │   ├── security-headers/ # HSTS, nosniff, X-Frame, COOP, CORP — Nginx/Apache/Cloudflare export
│   │   ├── password-strength/ # Entropy analysis, pattern detection (passwords never transmitted)
│   │   └── llm-token-calculator/ # BPE token estimation, editable pricing, 6 model presets
│   ├── types/
│   │   └── index.ts          # Shared TypeScript contracts: ToolDefinition, ToolCategory, etc.
│   ├── vite-env.d.ts         # Vite client types
│   ├── index.css             # Tailwind base styles and dark mode variables
│   └── main.tsx              # Application DOM entry point
├── tests/                    # Automated unit tests for all core logic
│   ├── jwt.test.ts
│   ├── base64.test.ts
│   ├── uuid.test.ts
│   ├── json-formatter.test.ts
│   ├── hash-generator.test.ts
│   ├── url-encoder.test.ts
│   ├── timestamp-converter.test.ts
│   ├── regex-tester.test.ts
│   ├── cron-generator.test.ts
│   ├── json-to-typescript.test.ts
│   ├── csp-generator.test.ts
│   ├── password-strength.test.ts
│   └── llm-token-calculator.test.ts
├── AGENT.md                  # This file — full architecture guide for AI agents
├── CLAUDE.md                 # Compact quick-reference for Claude/AI assistants
├── README.md                 # User-facing documentation
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 5. Key Architectural Patterns

### A. Modular Tool Registry (`src/tools/registry.ts`)
Do NOT hardcode routes or implement giant conditional branches (`if (tool === 'jwt') ...`).
Every tool conforms to the `ToolDefinition` interface in `src/types/index.ts`:

```typescript
interface ToolDefinition {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: ToolCategory;          // 'security' | 'data' | 'developer' | 'encoding' | 'ai'
  badge?: string;
  featured?: boolean;              // Shown in homepage featured section
  iconName?: string;               // Lucide icon name string (mapped in ToolCard)
  relatedTools?: string[];         // Array of tool IDs for RelatedTools component
  keywords: string[];
  component: React.ComponentType;
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
  };
  educationalContent?: EducationalSectionData;
}
```

**ToolCategory** values: `'security' | 'data' | 'developer' | 'encoding' | 'ai'`

Registry helpers available from `src/tools/registry.ts`:
- `REGISTERED_TOOLS` — array of all 15 tools
- `TOOL_CATEGORIES` — array of category metadata (id, label, description, icon)
- `getFeaturedTools()` — returns tools where `featured === true`
- `getToolById(id)` — lookup a tool by its id
- `getRelatedTools(tool, count)` — returns related tools based on `relatedTools` field

### B. Pure Logic Decoupled from UI
For every tool, keep core algorithmic logic in `src/tools/<tool-name>/logic/` separate from React components:
- `logic/`: Pure TypeScript functions. No React dependencies, zero hooks. 100% unit-testable via Vitest.
- `components/`: Pure presentation, state, and event handling.

### C. Safe Parsing & Input Limits
Always validate input size before performing regex or JSON/Base64 operations:
```typescript
import { validateInputSize, safeJsonParse, safeBase64Decode } from '../../../lib/security/safeParser';

const sizeCheck = validateInputSize(input);
if (!sizeCheck.valid) {
  // Return friendly error rather than crashing
}
```

Additional security helpers in `src/lib/security/safeParser.ts`:
- `safeBase64Encode(input)` — URL-safe Base64 encoding without padding
- `base64ToBase64Url(b64)` — converts standard Base64 to Base64URL

### D. Async Crypto Operations
Two tools use `crypto.subtle` and return Promises:
- **Hash Generator** — `computeHash(text, algorithm)` is `async`
- **JWT Generator** — `generateJwt(params)` is `async`

In components, handle these with `useEffect` + `useState` or `.then()`.

### E. Icon System
`ToolCard` and the icon system use a string-based `iconName` field (e.g. `'Shield'`, `'Hash'`, `'Clock'`).
The `ToolCard` component maps these strings to Lucide icon components internally.
Missing `iconName` falls back to `<Wrench>`.

### F. Homepage & Navigation
- Homepage URL: `/?category=security` filters by category
- Navbar links go to `/?category=<id>` (not separate routes)
- `useSearchParams()` from react-router-dom v7 is used in both `HomePage.tsx` and `Navbar.tsx`
- Featured tools appear in a dedicated section at the top of the homepage

### G. Breadcrumbs & Related Tools
`ToolPage.tsx` renders:
- `<Breadcrumbs>` — Home / Category / Tool Name navigation
- `<RelatedTools>` — 2–4 linked sibling tools at the bottom of each tool page

### H. Security Finding 3-Part Structure
When implementing security or analysis findings (as in the JWT Analyzer), always provide the 3-part structure:
1. `what`: What was detected
2. `why`: Why it may matter
3. `recommendation`: What the developer should consider doing

---

## 6. How to Add a New Tool (Agent Checklist)

When asked to add a new tool (e.g. `sql-formatter`, `whois-lookup`):

1. **Create Tool Directory**: `src/tools/<tool-id>/`
   - `types.ts`: Define inputs, options, results.
   - `logic/<tool-logic>.ts`: Pure functions handling computation/formatting/cryptography.
   - `components/<ToolName>Tool.tsx`: UI component using shared components (`CopyButton`, `ClearButton`, `ErrorMessage`, `CodeBlock`).
   - `metadata.ts`: `ToolDefinition` metadata, SEO title/description, and educational guide + FAQ entries.
   - `index.ts`: Default export and definition export.

2. **Register Tool**:
   - In `src/tools/registry.ts`, import the definition and append to `REGISTERED_TOOLS`.

3. **Add Unit Tests**:
   - In `tests/<tool-id>.test.ts`, write unit tests covering:
     - Normal valid input
     - Edge cases (empty, whitespace)
     - Malformed/invalid input
     - Unicode/UTF-8 handling (if string transformation)

4. **Verify Everything**:
   - Run `npm test` → must pass with zero failures.
   - Run `npm run build` → TypeScript compiler (`tsc`) must succeed with zero errors.

---

## 7. Code Style & Quality Guidelines

- **TypeScript**: Strict mode is enabled. Do not leave unused imports or unused variables (TS will reject `npm run build`). Avoid `any` types.
- **React Components**: Use functional components with `React.FC`. Use semantic HTML elements (`<section>`, `<label>`, `<header>`, `<footer>`, `<button>`).
- **Styling**: Use Tailwind CSS utility classes. Stick to the dark/neutral developer aesthetic (`slate-900`, `slate-950`, `emerald-500`, `emerald-400`).
- **Accessible Controls**: All icon-only buttons must have `aria-label` and `title` attributes. Provide visible focus rings (`focus:ring-2 focus:ring-emerald-500`).
- **Clipboard**: Always use `src/lib/formatting/clipboard.ts` (`copyToClipboard`) or `CopyButton` component.
- **Analytics**: Never pass user-supplied data to `analytics.track()`. Use metadata events only (e.g. `{ action: 'input_change' }` with no value payload). This is especially critical for password, JWT, and key inputs.

---

## 8. Cloudflare Pages Deployment Note

Cloudflare Pages serves the static output from `dist/`. The build prerenders the home page, five category pages, all 15 tool pages, and `404.html`, and generates `sitemap.xml` and `robots.txt`.

Cloudflare Pages serves `dist/<slug>.html` at the extensionless URL `/<slug>` and redirects `.html` requests to the extensionless form. Do not add a `/* /index.html 200` `_redirects` rule: it would serve the home page for every route and prevent crawlers from seeing the prerendered tool content.

Set `VITE_SITE_URL` to the production custom domain. Set `VITE_NOINDEX=true` only for preview/staging builds; production must leave it unset. See `README.md` for the full deployment and Search Console checklist.
