# AGENTS.md — repoDocs

Dashboard (repo público `repoDocs`) que lee y permite editar los `AGENTS.md` / `recomendaciones.md`
de los proyectos hermanos en `/home/sanchiro/proyectos/{SalseoGame,Impostor-Game}`.

## Config

La app es config-driven a partir de `mdboard.json` (defaults públicos, se commitea) + `mdboard.local.json`
(override local, **gitignoreado**):

- `projectsRoot` — carpeta con los proyectos a escanear (cada uno con sus `.md`).
- `status[]` — emojis/labels de estado (`done`/`pending`/`progress`): `emoji`, `label`, `plural`, `hint`.
- `brands` — identidad por proyecto (paleta, accent, stack) para `palette.ts` y el `PhoneMock`.
- `apps[]` — preview estilo app por proyecto; si queda vacío, se oculta el botón 📱 del topbar.

Lo carga `scripts/config.mjs` (deep-merge local > base). Env overrides: `MDBOARD_ROOT` (root) y
`MDBOARD_NO_WRITE=1` (desactiva el write-back; lo usa el smoke).

## Flujo crítico (no romper)

1. **`npm run sync`** (`scripts/sync-docs.mjs`) re-escanea los proyectos y **regenera**
   `src/generated/docs.ts` y `src/generated/appconfig.ts` (ambos auto-generados: NO editar a mano).
2. El usuario/agente edita los `.md` **reales**; para ver los cambios en el board alcanza con:
   - `npm run dev` (recarga en caliente), o
   - reconstruir (`npm run build`), o
   - volver a correr `npm run sync`.
3. Las ediciones hechas desde la UI se guardan siempre en localStorage (`pb:edits`) y, **si el server
   lo permite**, también se escriben en el `.md` real vía `POST /__mdboard/write` (middleware en
   `vite.config.ts`, `mdboardPlugin()`): reconstruye el doc con `assembleRaw()` y ejecuta el sync de
   nuevo. Con `MDBOARD_NO_WRITE=1` (o fuera de un server Vite) quedan solo en local.
   - Guardar una sección (✏️ → Guardar) o la intro → `writeSection()` (AppContext).
   - Botón **💾 Guardar** del topbar → `saveCurrentToFile()` (exporta el doc completo al `.md`).
   - **Exportar / Copiar** siguen estando: `assembleRaw()` en `src/lib/registry.ts`. Flujo manual:
     pegar el markdown exportado sobre los `.md` reales → `npm run sync`/recargar.
4. El write-back nunca borra archivos: valida `project` (directorio existente), `file` (solo `.md`,
   con `basename`) y no crea archivos nuevos (409 si no existe).

## Arquitectura

- `src/generated/docs.ts` — data auto-generada: `DOCS: Doc[]`, `groupsByProject`, types (`Doc`,
  `Section`, `Summary`, `DocStatus`, `StatusKey`). Cada `Section` tiene `startLine/endLine`
  (rangos 1-based en el archivo real), `raw`, `heading`, `kind` (`section` | `summary`),
  `status`, `statusCounts`.
- `src/generated/appconfig.ts` — auto-generada desde la config: `STATUS_META`, `BRANDS`, `APPS`,
  `PROJECTS_ROOT`.
- `src/lib/config.ts` — acceso tipado a la config generada (`STATUS_META`, `BRANDS`, `APPS`,
  `statusByKey`).
- `src/lib/registry.ts` — utilidades: `assembleRaw()` (reconstruye el `.md` completo aplicando las
  ediciones **por rangos de líneas**, para preservar separadores/orden; re-genera la tabla resumen
  si no fue editada). `sectionKey(base, id)` = `base ␟ ␞ id`.
- `src/lib/markdown.ts` — renderer marked + highlight.js. Emojis/estados leídos de la config.
  Tipos de los render hooks: `import { Marked, type Tokens } from 'marked'` (NO existen `Code`/`Heading`
  sueltos en marked v18).
- `src/state/AppContext.tsx` — estado global + persistencia localStorage. `baseKey` combina
  proyecto y archivo, y **todas** las claves de edición/canvas se derivan de `sectionKey(baseKey, id)`.
  Expone `writeSection` y `saveCurrentToFile` (write-back).
- `src/components/` — `Views.tsx` (board / canvas / inspector), `Cards.tsx` (IntroCard, SummaryCard,
  SectionCard, Markdown), `Sidebar`, `TopBar`, `PhoneMock`, `canvasLayout.ts`.
- `vite.config.ts` — `mdboardPlugin()`: endpoints `GET /__mdboard/health` y `POST /__mdboard/write`
  (en dev y preview). Importa `scripts/config.mjs` (necesita `// @ts-expect-error`, no tiene tipos).

## Reglas clave para editarlo

- **Excluir siempre `kind === 'summary'`** de tablero y canvas: la sección resumen se muestra por
  `SummaryCard` y su contenido (la tabla) es auto-generado; editarla directamente borraría la tabla
  del export. Regresar: `Views.tsx`.
- `Markdown` renderiza HTML del renderer `marked`; los ids de headings se escapan con `CSS.escape`.
- Los estados ya **no** están hardcodeados: vienen de la config (`status[]`). Cambiar emojis/labels
  = editar `mdboard.json` (o el local) y `npm run sync`.
- Al tocar el generador, re-ejecutar `npm run sync && npm run build` y el smoke:
  `npm run smoke` (levanta solo un preview en `:5199` con `MDBOARD_NO_WRITE=1` y lo cierra).
- Chequeos finales: `npm run lint`, `npm run build`. oxlint reporta solo warnings conocidos
  (only-export-components / set-state-in-effect, intencionales).

## Datos observados

- 2 proyectos escaneados: SalseoGame (AGENTS.md, recomendaciones.md, CLAUDE.md) e Impostor-Game
  (AGENTS.md, README.md, RECOMENDACIONES.md).
- 6 docs, 53 secciones en total. `recomendaciones.md` del SalseoGame = 7 secciones (resumen + A..F).
- Paletas reales: SalseoGame `theme.ts` (#140F1E / #FF4D6D), Impostor `colors.ts` (#7c5df8) — usadas
  en `src/lib/palette.ts` para los acentos y el `PhoneMock`.
- `examples/` contiene docs de demostración (config default `projectsRoot: ./examples`), para que el
  repo abierto funcione out-of-the-box.