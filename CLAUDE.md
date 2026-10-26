# CLAUDE.md — Developer Security Toolkit Instructions

This file provides project-specific guidance for Claude and other AI coding assistants working in this repository.

For full architectural details, see [`AGENT.md`](./AGENT.md).

---

## Commands

- **Install**: `npm install`
- **Dev**: `npm run dev` (starts local server on port 5173)
- **Test**: `npm test` (Vitest single run)
- **Test Watch**: `npm run test:watch`
- **Build**: `npm run build` (runs `tsc`, the client build, the SSR prerender build, and the SEO generator into `dist/`)
- **Preview**: `npm run preview`

---

## Project Summary

**Developer Security Toolkit** — 15 browser-based developer & security utilities. Privacy-first, 100% client-side, deployable as a static site on Cloudflare Pages.

### Tool Categories & Routes

| Category | Tools |
|----------|-------|
| Security | `/jwt-decoder`, `/hash-generator`, `/jwt-generator`, `/csp-generator`, `/security-headers`, `/password-strength` |
| Encoding | `/base64`, `/url-encoder` |
| Developer | `/uuid-generator`, `/timestamp-converter`, `/regex-tester`, `/cron-generator` |
| Data | `/json-formatter`, `/json-to-typescript` |
| AI | `/llm-token-calculator` |

---

## Core Architecture Principles

1. **100% Client-Side Privacy**: No user inputs (tokens, Base64 strings, keys, secrets, passwords) may ever be sent over the network, stored in cookies, or logged.
2. **Static Only**: Deployable to Cloudflare Pages. Zero backend (no Node/Express server, database, or serverless functions).
3. **Tool Registry Pattern**:
   - Every tool lives in its own directory: `src/tools/<tool-name>/`
   - Split `logic/` (pure, testable TypeScript) from `components/` (React UI)
   - Every tool exports metadata conforming to `ToolDefinition` in `src/types/index.ts`
   - Register new tools in `src/tools/registry.ts` (`REGISTERED_TOOLS`)
   - Routes (`/:slug`), homepage cards, search, and SEO are automatically generated from this registry.
4. **Defensive Parsing**: Use safe wrappers (`validateInputSize`, `safeJsonParse`, `safeBase64Decode`) from `src/lib/security/safeParser.ts`. Never use `dangerouslySetInnerHTML` or `eval()`.
5. **Strict TypeScript**: `noUnusedLocals` and `noUnusedParameters` are enabled. Unused imports or variables will break `npm run build`.
6. **Async Crypto**: Hash Generator and JWT Generator use `crypto.subtle` — their logic functions are `async` and return `Promise<Result>`.

---

## ToolCategory Values

`'security' | 'data' | 'developer' | 'encoding' | 'ai'`

---

## Adding a New Tool

1. Create `src/tools/<tool-slug>/` with `types.ts`, `logic/`, `components/`, `metadata.ts`, and `index.ts`.
2. Add the tool definition to `REGISTERED_TOOLS` in `src/tools/registry.ts`.
3. Add unit tests in `tests/<tool-slug>.test.ts`.
4. Ensure `npm test` and `npm run build` pass cleanly.
