# DocsBoard — example project

> This is a demo `AGENTS.md`: it shows how DocsBoard groups content into sections, status chips
> and a summary table.

---

## Status summary

| # | Topic | Status |
|---|-------|--------|
| 1 | Configure DocsBoard with your repo | 📌 Pending |
| 2 | Define palette and app preview | ✅ Done |
| 3 | Write edits back to the real .md files | ✅ Done |

---

## A. First steps — ✅ Done

Copy `mdboard.json` to the DocsBoard root and point `projectsRoot` at the folder containing your
projects (each with its `AGENTS.md` / `RECOMENDACIONES.md`).

### 1. Configuration — 📌 Pending

**Context:** projects are detected automatically when you run `npm run dev`.

**Proposal:**
- Put `projectsRoot` in your `mdboard.local.json` (it is not committed).
- Tune `status` if your docs use other status emojis (defaults: `✅` done, `📌` pending, `🔶` in progress).

---

## B. Customization — ✅ Done

Brands (`brands`) and app previews (`apps`) live in the config; the board has none of your projects
hardcoded.

---