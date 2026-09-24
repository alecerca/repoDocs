# repoDocs

Turn a folder of Markdown docs (one per repo) into a **Figma-like board** — read, search,
filter by status, edit every section, and write changes straight back to the real `.md` files.

![repoDocs screenshot](assets/screenshot.png)

## Preview

| Canvas view | Mobile app preview | Web app preview |
| ----------- | ------------------ | --------------- |
| ![Canvas view](assets/canvas.png) | ![Mobile app preview](assets/mobile.png) | ![Web app preview](assets/web.png) |

## Why

`AGENTS.md` / `README.md` files are the single source of truth for a project, but
reading them inside the repo you're coding in is a poor experience. repoDocs reads any folder
with `.md` files, turns modern documents into cards on a board (or a canvas), and lets you:

- **Read** long docs as separate, collapsible sections.
- **Search** and **filter by status** (✅ done · 📌 pending · 🔶 in progress — labels configurable
  globally, per project, per document, or in a document's frontmatter).
- **Edit** any section in place with live Markdown preview and a **formatting toolbar** (no Markdown
  knowledge required).
- **Export / write back** the full Markdown to the original `.md` files.
- **Preview** a phone-style mock **and/or a desktop web mock** of your project (config-driven, optional).
- **Smooth UX**: keyboard shortcuts (`Ctrl/⌘+K`, `B`/`C`, `E`), per-section undo and undo on reset,
  collapse all / expand all, clickable status chips, a first-run **onboarding tour**, and a
  distraction-free **focus/reading mode**. UI is bilingual (EN/ES).

## Quick start

```bash
npm install
npm run dev        # scans ./examples → http://localhost:5173
```

It works out of the box with the demo docs in `examples/`. Point it at your own repos:

```bash
cp mdboard.json mdboard.local.json   # then edit (mdboard.local.json is gitignored)
```

```jsonc
{
  "projectsRoot": "../my-projects-folder", // each subfolder with its .md files
  "status": [
    { "key": "done", "emoji": "✅", "label": "Completada", "plural": "Completadas", "hint": "completad|listo" },
    { "key": "pending", "emoji": "📌", "label": "Pendiente", "plural": "Pendientes", "hint": "pendiente|falta" },
    { "key": "progress", "emoji": "🔶", "label": "En progreso", "plural": "En progreso", "hint": "en progreso|validad" }
  ],
  "brands": {
    "my-projects-folder": { "accent": "#7c5df8", "palette": ["#7c5df8", "#f59e0b"], "stack": ["React Native", "Expo"],
      "status": { "progress": { "label": "En desarrollo", "plural": "En desarrollo" } }, // per-project label override
      "docs": { "AGENTS.md": { "status": { "pending": { "label": "Backlog", "plural": "Backlog" } } } } // per-document override
    }
  },
  "apps": [ // optional: phone-style previews; empty = hide the 📱 button
    { "forProject": "my-projects-folder", "name": "My App", "screen": { "kind": "party", "title": "🍾 My App" } }
  ],
  "websites": [ // optional: desktop web-style previews (shown next to the app mock)
    { "forProject": "my-projects-folder", "name": "My Site", "url": "mysite.example.com",
      "screen": { "kind": "landing", "nav": ["Features", "Docs"], "hero": "My site hero",
                  "cta": "Get started", "points": ["One", "Two"] } }
  ]
}
```

Status labels cascade per document: global `status[]` → `brands.<project>.status` →
`brands.<project>.docs.<file>.status` → frontmatter. The final labels are emitted per document and
shown on the chips (e.g. *Shipped* instead of *Done*).

`mdboard.json` holds the public defaults (commit it). Put everything local/private in
`mdboard.local.json` (already gitignored).

## Editing workflow

- Edits always land in the browser first (`localStorage`, key `pb:edits`).
- When served by a Vite server (dev/preview), **saving a section writes it back to the real `.md`**
  (`POST /__mdboard/write` middleware) — and the **💾 Save** button in the top bar writes the whole
  document. Set `MDBOARD_NO_WRITE=1` (or run outside Vite) to keep edits local-only.
- **Export / Copy** rebuilds the full Markdown with your changes applied, for manual pasting.
- **↺ Reset** discards all local edits (never touches files).

## ADR Premium (Decisions)

| Decisions board | Relations graph |
| --------------- | --------------- |
| ![ADR Decisions board](assets/adr-premium.png) | ![ADR relations graph](assets/adr-graph.png) |

**Qué es.** Architectural Decision Records (ADRs) son fichas que documentan cada decisión de
arquitectura de un proyecto — y el contexto y las consecuencias detrás de ella. repoDocs los lee de
tu carpeta `docs/adr/` (o las que configures en `mdboard.json` → `adr.paths`) y los convierte en un
tablero de decisiones **conectadas**: quién reemplaza a quién, qué depende de qué, y cuál es la
decisión vigente al final de cada cadena.

**La idea.** En cada repo los ADR viven como `.md` planos y desconectados: resolver "¿esto ya se
decidió?" es abrir archivos a mano y leer. repoDocs los parsea (front-matter en **YAML** `---`,
**JSON** `;;;` o **TOML** `+++`, con heurísticas para markdown "sucio"), resuelve las relaciones
(`supersedes`, `superseded_by`, `related_to`, `depends_on`), detecta cadenas de supersession y te da
dos vistas:

- **List** — cards con status, badges de relación y alertas de supersession en contexto.
- **Graph** — canvas SVG a ancho completo con las flechas dirigidas (drag, pan/zoom, foco por nodo)
  y **export a Mermaid** (`.mmd`) para pegarlo en un README o un PR.

**Cómo verlo en la demo.** `npm run dev` levanta la app con **6 ADRs de ejemplo** en `examples/`
con relaciones reales: abrí **🧭 Decisions** (toggle del topbar o atajo `D`) y jugá con **☑ List /
🕸 Graph** y el export `.mmd`.

**Cómo se usa con ADRs reales.** Poné tus ADRs (convención `NNNN-titulo.md`, formato `adr-tools` /
MADR) en `docs/adr/` de tu proyecto → `npm run sync` → la vista Decisions aparece con todo; `npm run
adr:lint` te avisa en CI de relaciones rotas. Editar, write-back y exportar funcionan igual que el
resto de los docs.

**Cómo pagarlo.** Una licencia **lifetime** desbloquea el grafo, el export y el límite de ADRs
(gratis llega a **10 ADRs por proyecto**, el resto queda con candado 🔒):

| Tier | Precio | Qué desbloquea |
| ---- | ------ | -------------- |
| 🏢 **Studio** (GitHub Sponsors) | **$20/mes** | licencia automática de ADR Premium al sponsor-view |

El webhook está **en vivo** en `server/` (deploy gratis en Vercel): hoy emite por **GitHub
Sponsors** (`$20/mo`, firma `X-Hub-Signature-256`), y soporta también **Gumroad** /
**Lemon Squeezy** si preferís otro canal — config: `server/README.md`.

**Qué pasa al pagar.**
1. El webhook (`api/webhook.mjs`) valida la firma HMAC del evento de Sponsors, confirma que el tier
   es el de $20 y firma un **token Ed25519** con tu clave privada (`{product, seats, issued, email}`).
2. El token te llega por mail (opcional) y también se devuelve en la respuesta del webhook.
3. Lo pegás en la app: botón **🔑** en la vista Decisions (o `mdboard.local.json` → `license`).
4. Se valida **offline** contra la clave pública embebida (`src/lib/license.ts`): sin internet, sin
   telemetría, sin llamadas a tu servidor. Con la licencia activa: grafo completo, export y ADRs sin
   límite.

## Scripts

| Command            | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `npm run sync`     | Rescan `projectsRoot`, regenerate `src/generated/{docs,appconfig}.ts` and `adr.ts` |
| `npm run adr:lint` | Check ADR relations / missing Context sections (exit code ≠ 0 if broken) |
| `npm run webhook:local` | Run the license issuing webhook on `:8787` |
| `npm run dev`      | Vite dev server (runs sync first)                                  |
| `npm run build`    | `tsc -b && vite build` (runs sync first)                           |
| `npm run lint`     | oxlint                                                             |
| `npm run smoke`    | E2E smoke test (spawns its own preview on :5199, writes disabled)  |
| `npm test`         | Unit tests: ADR parser (YAML/JSON/TOML), license, webhook, Mermaid, config |

## How it works

- `scripts/sync-docs.mjs` parses each `.md` into sections (H1/H2 blocks), detects **status**
  from the config emojis and the **summary table** (kept as a special `summary` section that is
  regenerated on export rather than edited).
- Edits are stored **per line range** (`src/lib/registry.ts` `assembleRaw()`), so separators and
  ordering are preserved and the exported Markdown is byte-identical when nothing is edited.
- `src/generated/` is auto-generated and **gitignored** — it never commits your private docs.

## Sponsor

repoDocs is free and MIT-licensed. If it saves your team time, a small recurring contribution
directly funds the [`funded`](https://github.com/alecerca/repoDocs/labels/funded) roadmap items
([GitHub integration](https://github.com/alecerca/repoDocs/issues/4),
[canvas export](https://github.com/alecerca/repoDocs/issues/5),
[plugin system](https://github.com/alecerca/repoDocs/issues/6)).

| Tier          | Price   | What you get                                                     |
| ------------- | ------- | ---------------------------------------------------------------- |
| ☕ **Coffee**   | $3/mo   | Vote on roadmap priorities                                       |
| 🚀 **Supporter** | $8/mo   | Prioritized issue requests                                       |
| 🏢 **Studio**   | $20/mo  | Office/team support + **ADR Premium license** (automatic)        |

[![Sponsor](https://img.shields.io/badge/-Sponsor-1a1e27?style=flat-square&logo=GitHub-Sponsors&logoColor=EA4AAA)](https://github.com/sponsors/alecerca)
See [SPONSORING.md](SPONSORING.md) for details.

## License

[MIT](LICENSE) © 2026 [Alejandro Guerrero](https://github.com/alecerca).
