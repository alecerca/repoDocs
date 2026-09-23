# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-23

### Added

- **Markdown board & canvas**: read every `.md` in a root folder (one project = one subfolder),
  render sections as collapsible cards on a board or a free-form Figma-like canvas.
- **Config-driven everything** (`mdboard.json` + gitignored `mdboard.local.json`):
  - `projectsRoot` — where the projects live.
  - `status[]` — configurable status emojis / labels / hints (`✅ done`, `📌 pending`, `🔶 progress`).
  - `brands` — per-project palette, accent and stack (used for accents and sidebar left-dot).
  - `apps[]` — optional phone-style previews; hide the 📱 button when empty.
- **Editing** every section (and the intro) with live Markdown preview; **edits persist in
  localStorage** (`pb:edits`) and are applied per line-range so separators and ordering survive.
- **Write-back**: when served by a Vite server, saving a section or pressing 💾 **Save** writes
  the change back to the real `.md` file via `POST /__mdboard/write` middleware.
  `MDBOARD_NO_WRITE=1` disables it (e.g. for the smoke tests). Fallback stays local-only.
- **Summary table** detection + regeneration on export (`kind: 'summary'` sections are
  auto-maintained instead of edited).
- **Search** across sections and **status filters** (`all | done | pending | progress`).
- **Code highlighting** via highlight.js with a copy button.
- **Export / Copy** the full reconstructed Markdown (byte-identical when nothing is edited).
- Demo docs in `examples/` — the repo works out of the box.
- GitHub Pages workflow (`GH_PAGES=1` → base `/repoDocs/`) and `FUNDING.yml`.

### Docs

- English README with screenshot and Quick Start.
- `AGENTS.md` (Spanish) documenting architecture and the don't-break rules.
- MIT license.

### Testing

- Playwright smoke test (`npm run smoke`) covering board, canvas, inspector, editing, export
  with summary table, reset and app preview. Writes are disabled during the test.