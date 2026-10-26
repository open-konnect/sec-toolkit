# AGENT.md — Developer Security Toolkit Instructions & Architecture Guide

Welcome, AI coding assistant or autonomous agent. This document provides complete project context, architectural guidelines, directory structures, testing standards, and step-by-step instructions for extending the **Developer Security Toolkit**.

---

## 1. Project Overview & Ethos

**Developer Security Toolkit** is an extensible, privacy-first web application providing free developer and security utilities. 

### Core Ethos & Non-Negotiable Rules:
- **100% Client-Side Processing**: All processing occurs strictly inside the user's browser using native Web APIs (`crypto.randomUUID()`, `crypto.getRandomValues()`, `TextEncoder`, `TextDecoder`, `JSON.parse`).
- **Zero Data Transmission**: User inputs (tokens, Base64 strings, keys, secrets) **must never** be uploaded to any server, stored in cookies, or sent to telemetry/analytics.
- **Static Frontend Only**: Built using React, TypeScript, Vite, and Tailwind CSS. Deployable to Cloudflare Pages as a static site (`npm run build` produces `dist/`). Zero backend servers, Express, Docker, Redis, or serverless functions.
- **Defensive Engineering**: Protect against browser freezing and crashes using input size limits (`validateInputSize`) and safe parsers (`safeJsonParse`, `safeBase64Decode`). Never use `eval()` or `dangerouslySetInnerHTML`.

---

## 2. Tech Stack & Commands

- **Language**: TypeScript (strict mode: `noUnusedLocals`, `noUnusedParameters` enabled)
- **Framework**: React 18 + React Router 6
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3 (dark mode enabled by default)
- **Icons**: `lucide-react`
- **Testing**: Vitest 2

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

## 3. Project Structure

```text
sec-toolkit/
├── public/
│   ├── _redirects            # Cloudflare Pages SPA rewrite (/* /index.html 200)
│   └── robots.txt            # Search engine directives
├── src/
│   ├── app/
│   │   ├── App.tsx           # BrowserRouter mount
│   │   └── routes.tsx        # Dynamic route dispatcher & scroll-to-top handler
│   ├── components/
│   │   ├── layout/           # Navbar, Footer, Layout wrapper
│   │   ├── tool/             # ToolHeader, ToolCard, SecurityFinding, EducationalSection, SEOHead
│   │   └── ui/               # Button, Badge, CodeBlock, CopyButton, ClearButton, JsonViewer, AdSlot
│   ├── lib/
│   │   ├── analytics/        # Privacy-first pluggable analytics interface (no-op by default)
│   │   ├── formatting/       # Timestamp conversions, duration math, clipboard copy
│   │   └── security/         # Safe Base64/JSON parsers, input size limits
│   ├── pages/
│   │   ├── HomePage.tsx      # Tool directory, search, category filter, privacy guarantee
│   │   ├── ToolPage.tsx      # Dynamic tool renderer with automated SEO and FAQs
│   │   └── NotFoundPage.tsx  # 404 handler with quick navigation
│   ├── tools/
│   │   ├── registry.ts       # Central tool registry and category configuration
│   │   ├── jwt/              # Flagship JWT Analyzer module (components, logic, types, metadata)
│   │   ├── base64/           # Base64 Converter module (components, logic, types, metadata)
│   │   └── uuid/             # UUID Generator module (components, logic, types, metadata)
│   ├── types/
│   │   └── index.ts          # Shared TypeScript contracts and tool definitions
│   ├── vite-env.d.ts         # Vite client types
│   ├── index.css             # Tailwind base styles and dark mode variables
│   └── main.tsx              # Application DOM entry point
├── tests/                    # Automated unit tests for all core logic
│   ├── jwt.test.ts           # JWT decoding and security heuristics tests
│   ├── base64.test.ts        # UTF-8, Base64URL, and malformed handling tests
│   └── uuid.test.ts          # CSPRNG, RFC v4 format, bulk uniqueness tests
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 4. Key Architectural Patterns

### A. Modular Tool Registry (`src/tools/registry.ts`)
Do NOT hardcode routes or implement giant conditional branches (`if (tool === 'jwt') ...`).
Every tool conforms to the `ToolDefinition` interface:
```typescript
interface ToolDefinition {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: 'security' | 'data' | 'developer' | 'ai';
  badge?: string;
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
All tools are registered in the `REGISTERED_TOOLS` array in `src/tools/registry.ts`. The homepage cards, search filters, routing, and SEO automatically populate from this registry.

### B. Pure Logic Decoupled from UI
For every tool, keep core algorithmic logic in `src/tools/<tool-name>/logic/` separate from React components:
- `logic/`: Pure TypeScript functions (e.g. `parseJwt`, `convertBase64`, `generateBulkUuids`). No React dependencies, zero hooks. This makes all business and cryptographic logic 100% unit-testable via Vitest.
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

### D. Security Finding 3-Part Structure
When implementing security or analysis findings (as in the JWT Analyzer), always provide the 3-part structure:
1. `what`: What was detected
2. `why`: Why it may matter
3. `recommendation`: What the developer should consider doing

---

## 5. How to Add a New Tool (Agent Checklist)

When asked to add a new tool (e.g. `json-formatter`, `hash-generator`, `csp-generator`):

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
   - Run `npm test` -> must pass with zero failures.
   - Run `npm run build` -> TypeScript compiler (`tsc`) must succeed with zero warnings/errors.

---

## 6. Code Style & Quality Guidelines

- **TypeScript**: Strict mode is enabled. Do not leave unused imports or unused variables (TS will reject `npm run build`). Avoid `any` types.
- **React Components**: Use functional components with `React.FC`. Use semantic HTML elements (`<section>`, `<label>`, `<header>`, `<footer>`, `<button>`).
- **Styling**: Use Tailwind CSS utility classes. Stick to the dark/neutral developer aesthetic (`slate-900`, `slate-950`, `emerald-500`, `emerald-400`).
- **Accessible Controls**: All icon-only buttons must have `aria-label` and `title` attributes. Provide visible focus rings (`focus:ring-2 focus:ring-emerald-500`).
- **Clipboard**: Always use `src/lib/formatting/clipboard.ts` (`copyToClipboard`) or `CopyButton` component.
- **Analytics**: Never pass user-supplied data to `analytics.track()`. Use metadata events only.

---

## 7. Cloudflare Pages Deployment Note

Cloudflare Pages serves the static output from `dist/`. The single-page app rewrite is handled by `public/_redirects`:
```text
/* /index.html 200
```
This guarantees direct URL navigation to any tool (`/jwt-decoder`, `/base64`, `/uuid-generator`, etc.) works seamlessly without server-side routing.
