# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Keyboard shortcuts**: `Ctrl/⌘+K` focuses search, `B` / `C` switch board ↔ canvas, `E` edits the
  focused section (esc is always available to abort).
- **Formatting toolbar** in the inline editor (bold, italic, strikethrough, inline code, link, lists,
  quote) — write Markdown without knowing the syntax.
- **Per-section undo**: edited cards get a `↩` restore button, and **`↺ Reset` now offers Undo**
  inside the toast.
- **Collapse all / expand all** on the board, plus a keyboard hint line.
- **Clickable status chips**: clicking a chip on a card (or in the summary) filters the board to that
  status; clicking the active one clears the filter.
- **First-run onboarding tour**: 4 coach-marks pointing at search, section editing, save and the
  view switcher (dismissible; stored in `pb:seenTour`).
- **Focus / reading mode** (👓 toggle in the topbar): hides chrome, centers and enlarges the text,
  persisted in `pb:ui`.
- **Web preview**: alongside the phone-style app mock, a desktop **browser preview** (config-driven
  via `websites[]`), switchable in the same overlay with an App | Web toggle.
- Demo docs and demo config are now **in English**; the summary table headers are config-driven
  (`summary.headers`) so exported tables match the document language.
- **ADR Premium — phases 1–3**: a `🧭 Decisions` view (toggle with `D` / topbar) that parses
  architecture decision records into the board. Each project can point `adr.paths` at its decisions
  folder (defaults `docs/adr`, `adr`, `decisions`) and optionally configure `adr.status` labels.
  - **Parser**: reads front-matter (id, title, status, date, deciders, `supersedes`/`superseded_by`/
    `related_to`/`depends_on`) with a plain-text heuristic fallback; ids are canonicalized so
    `0007 → 7`; section ranges (`Context`/`Decision`/`Consequences`) keep the byte-exact write-back
    story from the docs flow, and a `pb:adredits` layer persists edits locally with
    `POST /__mdboard/write` when the server allows it.
  - **Relations**: cross-referenced ADRs get badges; superseded/adopted decisions surface an inline
    alert on the card; broken references are reported by `npm run adr:lint` (`--lint`, non-zero exit).
  - **Graph**: layered SVG graph with drag-to-reposition (persisted per project in
    `pb:adrGraph:<project>`), background pan, wheel zoom and fit-to-view, with supersession edges
    highlighted.
  - **Demo**: 6 interrelated example ADRs (0001–0006) under `examples/docsboard-demo/docs/adr/`;
    tests in `test/adr.test.mjs` cover parsing, canonical ids, the heuristic and relation resolution.

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
- **i18n** (EN/ES) with a language toggle in the topbar; **English is the default**.
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