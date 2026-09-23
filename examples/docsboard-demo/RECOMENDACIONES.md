# Recommendations · example project

> Live example document with statuses: ✅ Done · 📌 Pending · 🔶 In progress

---

## Status summary

| # | Topic | Status |
|---|-------|--------|
| 1 | Refactor the docs generator | 🔶 In progress |
| 2 | Byte-identical export without edits | ✅ Done |
| 3 | Automated E2E smoke test | ✅ Done |

---

## A. Quality

### 1. Refactor the docs generator — 🔶 In progress

**Context:** `sync-docs.mjs` was growing with hardcoded business logic.

**Proposal:** move root, status emojis and brands to `mdboard.json` and generate
`src/generated/appconfig.ts` for the frontend.

---

## B. Export fidelity — ✅ Done

Without edits, the exported markdown must be byte-identical to the original file. The `trimEnd()`
calls in the generator and the line-ending normalization in `assembleRaw` were removed.

---

## C. Verification — ✅ Done

`scripts/smoke.mjs` (Playwright) covers navigation, editing, export with the summary table, reset
and the app preview. It runs without console errors.

---