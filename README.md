# Developer Security Toolkit

> Free, fast, privacy-first developer and security utilities that run 100% in your browser.

A production-grade, extensible web application providing client-side security and developer utilities. Built with **React**, **TypeScript**, **Vite**, and **Tailwind CSS**, designed for zero-backend deployment directly to **Cloudflare Pages**.

---

## 🔒 Privacy Model & Security Guarantee

All data processing happens **locally inside the user's browser**:

- **No Remote Transmission**: Your tokens, Base64 strings, and generated keys are never transmitted to any server or API.
- **Zero Input Logging**: No user input is ever written to telemetry, analytics, cookies, or remote storage.
- **Client-Side Cryptography**: Cryptographic operations rely strictly on the native Web Cryptography API (`crypto.randomUUID()` and `crypto.getRandomValues()`).
- **Safe Parsing Guards**: Input size limits (512 KB safe client threshold) prevent browser freezing or runaway memory consumption on malformed inputs.
- **No Unsafe HTML Injection**: All JSON and token data is rendered as structured React components, completely avoiding `dangerouslySetInnerHTML` or `eval()`.

> **Guarantee:** Your data stays in your browser. These tools process your input locally and do not upload it.

---

## 🛠 Available Tools (Version 1.0)

### 1. JWT Decoder & Security Analyzer (Flagship Tool) — `/jwt-decoder`
- **Decode vs. Verify Distinction**: Prominently clarifies that decoding reads claims without verifying cryptographic authenticity.
- **JOSE Header & Payload Inspection**: Formatted JSON viewer with claim annotations (`iss`, `sub`, `aud`, `jti`, etc.).
- **Timestamp Inspection**: Automatically parses `exp`, `nbf`, `iat`, and `auth_time` into raw Unix epoch, UTC date/time, and human-readable relative duration.
- **Automated Static Security Heuristics**:
  - `alg: "none"` signature bypass detection (Critical)
  - Missing algorithm header detection (Critical)
  - Expired token detection (Medium)
  - Future `nbf` (Not Before) detection (Medium)
  - Future `iat` (Issued At) drift detection (Low)
  - Unusually long token lifetime (> 1 year) warning (Low)
  - Symmetric algorithm key sharing warning (Low)
  - Unverified signature reminder on every token (Info)
- **3-Part Security Findings**: Every finding explicitly outlines:
  1. *What was detected*
  2. *Why it matters*
  3. *Recommended action*
- **Sample Presets**: Instantly load realistic RS256 active, expired, `alg: none`, and long-lived tokens for testing.

### 2. Base64 & Base64URL Converter — `/base64`
- **Bi-Directional**: Live encoding and decoding.
- **RFC 4648 Support**: Standard Base64 (`+`, `/`, `=`) and URL-Safe Base64URL (`-`, `_`, unpadded).
- **True UTF-8 Handling**: Native `TextEncoder` and `TextDecoder` pipeline handles international characters, multi-byte Unicode, and emojis without crashing.
- **Interactive Controls**: Instant Swap, Copy, and whitespace-resilient decoding.

### 3. Cryptographic UUID Generator — `/uuid-generator`
- **RFC 4122 Version 4**: Powered by the browser's cryptographically secure pseudo-random number generator (`crypto.randomUUID()`). Zero insecure `Math.random()` usage.
- **Single & Bulk Generation**: Generate 1, 5, 10, 25, 50, or custom quantities up to 500.
- **Formatting Options**: Uppercase/lowercase toggles, with or without hyphens.
- **Built-in Validator**: Paste any UUID to instantly verify if it conforms to the RFC 4122 v4 specification.

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
│   │   ├── layout/           # Navbar, Footer, Layout wrapper
│   │   ├── tool/             # ToolHeader, ToolCard, SecurityFinding, EducationalSection, SEOHead
│   │   └── ui/               # Reusable Button, Badge, CodeBlock, CopyButton, ClearButton, JsonViewer, AdSlot
│   ├── lib/
│   │   ├── analytics/        # Privacy-first pluggable analytics interface (no-op by default)
│   │   ├── formatting/       # Timestamp conversions, duration math, clipboard copy
│   │   └── security/         # Safe Base64/JSON parsers, input size validation
│   ├── pages/
│   │   ├── HomePage.tsx      # Tool directory, search, category filter, privacy guarantee
│   │   ├── ToolPage.tsx      # Dynamic tool renderer with automated SEO and FAQs
│   │   └── NotFoundPage.tsx  # 404 handler with quick navigation
│   ├── tools/
│   │   ├── registry.ts       # Central tool registry and category configuration
│   │   ├── jwt/              # Flagship JWT Analyzer module
│   │   ├── base64/           # Base64 Converter module
│   │   └── uuid/             # UUID Generator module
│   ├── types/
│   │   └── index.ts          # Shared TypeScript contracts and tool definitions
│   ├── index.css             # Tailwind base and dark mode styles
│   └── main.tsx              # DOM root mount
├── tests/                    # Automated unit tests for all core logic
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 How to Add a New Tool

The tool registry architecture allows future developer, security, data, and AI utilities to be added cleanly without refactoring routing, navigation, or shared layouts.

Follow these 4 simple steps to add a new tool (e.g., `json-formatter`):

### Step 1: Create the Tool Directory
Create `src/tools/json-formatter/` with the following structure:
```text
src/tools/json-formatter/
├── components/
│   └── JsonFormatterTool.tsx # Tool interactive UI
├── logic/
│   └── formatter.ts          # Pure business logic (easy to unit test)
├── types.ts                  # Tool-specific types
├── metadata.ts               # Metadata, SEO tags, and educational FAQ content
└── index.ts                  # Export definition
```

### Step 2: Implement Logic & Component
Create your pure conversion logic and the React component:

```typescript
// src/tools/json-formatter/logic/formatter.ts
export function formatJson(input: string, indent = 2): { formatted: string; error?: string } {
  try {
    const parsed = JSON.parse(input);
    return { formatted: JSON.stringify(parsed, null, indent) };
  } catch (err) {
    return { formatted: '', error: (err as Error).message };
  }
}
```

### Step 3: Define Metadata and Educational SEO
```typescript
// src/tools/json-formatter/metadata.ts
import { ToolDefinition } from '../../types';

export const jsonFormatterMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'json-formatter',
  slug: 'json-formatter',
  name: 'JSON Formatter & Validator',
  shortDescription: 'Format, validate, and beautify JSON payloads client-side.',
  description: 'Fast, browser-based JSON beautifier with syntax validation.',
  category: 'data',
  keywords: ['json', 'json formatter', 'beautifier'],
  seo: {
    title: 'JSON Formatter & Validator — Privacy-First',
    description: 'Format and inspect JSON data locally in your browser.',
    canonicalPath: '/json-formatter'
  },
  educationalContent: {
    title: 'Understanding JSON Standards',
    content: [{ heading: 'Syntax Rules', body: 'JSON keys must be double-quoted strings...' }],
    faqs: [{ question: 'Is my JSON uploaded?', answer: 'No, all formatting is local.' }]
  }
};
```

Export the definition in `src/tools/json-formatter/index.ts`:
```typescript
import { jsonFormatterMetadata } from './metadata';
import { JsonFormatterTool } from './components/JsonFormatterTool';
import { ToolDefinition } from '../../types';

export const jsonFormatterToolDefinition: ToolDefinition = {
  ...jsonFormatterMetadata,
  component: JsonFormatterTool
};

export default JsonFormatterTool;
```

### Step 4: Register in `src/tools/registry.ts`
Add one line to `REGISTERED_TOOLS` in `src/tools/registry.ts`:

```typescript
import { jsonFormatterToolDefinition } from './json-formatter';

export const REGISTERED_TOOLS: ToolDefinition[] = [
  jwtToolDefinition,
  base64ToolDefinition,
  uuidToolDefinition,
  jsonFormatterToolDefinition // <-- Newly added
];
```

**That's it!** The tool will automatically:
- Be assigned its clean URL route (`/json-formatter`)
- Render on the Homepage with search and category tags
- Populate dynamic SEO meta tags and structured schema
- Integrate with privacy notices and future ad slots

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

Run automated unit tests for all core algorithmic logic (JWT, Base64, and UUID):

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 📦 Building for Production

Compile TypeScript and build the optimized static bundle with Vite:

```bash
npm run build
```

The production output will be generated in the `dist/` directory.

To preview the production build locally:
```bash
npm run preview
```

---

## ☁️ Deployment: GitHub → Cloudflare Pages

This project requires **zero backend servers**, databases, or container infrastructure. It deploys natively as a static site via Cloudflare Pages.

### Step-by-Step Instructions:

1. **Push to GitHub**:
   Push the codebase to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial release: Developer Security Toolkit"
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```

2. **Connect to Cloudflare Pages**:
   - Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
   - In the sidebar, navigate to **Compute (Workers & Pages)** > **Create application** > **Pages** > **Connect to Git**.
   - Select your GitHub repository.

3. **Configure Build Settings**:
   - **Project Name**: `developer-security-toolkit` (or your choice)
   - **Production Branch**: `main`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
   - **Root Directory**: *(leave blank / default)*

4. **Deploy**:
   - Click **Save and Deploy**.
   - Cloudflare Pages will install dependencies, build the static assets, and deploy to a free subdomain:
     `https://developer-security-toolkit.pages.dev`
   - Future commits to `main` will automatically trigger atomic preview and production builds.

> **Note on Routing:** The `public/_redirects` file automatically instructs Cloudflare Pages to rewrite all SPA paths (`/* /index.html 200`), enabling direct link access (e.g. `/jwt-decoder`) without 404 errors.

---

## 📈 Future Architecture Extension Points

### Future Monetization (`AdSlot`)
An `AdSlot` component is placed strategically in the layout. In Version 1.0, it is **completely disabled** with zero external ad scripts or tracking networks loaded. When non-intrusive developer sponsorships or ads are introduced later, they can be enabled at this single extension point without redesigning the application.

### Future Premium Capabilities
The modular tool registry and decoupled pure logic functions allow future client-side and authenticated capabilities (such as saved history, team workspaces, or offline PWA mode) to be added incrementally without rewriting core utilities.

---

## 📄 License

MIT License. Free for developers, teams, and security researchers.
