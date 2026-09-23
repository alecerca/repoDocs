# repoDocs Plugin System Architecture & API

repoDocs features an extensible plugin system allowing projects to introduce custom importers, exporters, markdown dialect handlers, frontmatter parsers, and custom status table emitters.

Plugins reside in `scripts/plugins/*.mjs` and are dynamically discovered by `scripts/plugins.mjs`.

## Core Invariant

The default parser behavior remains unchanged when no plugins match or when plugin hooks return `null`/`undefined`. Existing workflows that rely on standard `# Title`, `> Subtitle`, `# / Topic / Status` tables, and emoji status markers continue to function identically.

---

## Plugin Lifecycle

The parsing and emission lifecycles consist of distinct hook phases executed in priority order.

### Parser / Importer Pipeline

```
Raw File Content
       │
       ▼
1. beforeParse (strip/normalize raw text, parse frontmatter metadata)
       │
       ├─────────────────────────┬─────────────────────────┐
       ▼                         ▼                         ▼
2. parseTitle             3. parseSummaryTable      4. parseSections
(custom title/subtitle)   (custom column mappings)  (custom block splitting)
                                                           │
                                                           ▼
                                                    5. detectStatus
                                                    (custom dialects/checkboxes)
                                                           │
       ┌───────────────────────────────────────────────────┘
       ▼
6. afterParse (enrich doc with metadata, tags, frontmatter)
       │
       ▼
Emitted Doc Object
```

### Emitter / Exporter Pipeline

```
Doc Object + Edits
       │
       ▼
1. beforeEmit (pre-process document model and edits)
       │
       ├─────────────────────────┐
       ▼                         ▼
2. emitSummaryTable       3. emitSection
(custom table serializer) (custom section serializer)
       │                         │
       └───────────┬─────────────┘
                   ▼
       Assembled Markdown Text
                   │
                   ▼
       4. afterEmit (re-inject frontmatter, dialect formatting)
                   │
                   ▼
       Final Written Markdown File
```

---

## Plugin API Specification

A plugin is an ES module exporting a plugin object (default export or named export).

### Plugin Metadata & Scoping

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | Unique identifier for the plugin. Defaults to the filename basename. |
| `version` | `string` | Optional semantic version string. |
| `priority` | `number` | Execution precedence. Higher numbers run first (default: `0`). |
| `enabled` | `boolean` | Set to `false` to disable the plugin. |
| `projects` | `string[] \| string \| RegExp` | Filters the plugin to specific project names. |
| `files` | `string[] \| string \| RegExp` | Filters the plugin to specific document filenames (e.g., `AGENTS.md`). |
| `match` | `(context: PluginContext) => boolean` | Dynamic predicate for activation. |

### Context Object

All hooks receive a `PluginContext` object containing:

```typescript
interface PluginContext {
  filePath: string
  projectName: string
  file: string
  raw: string
  lines?: string[]
  config?: Record<string, unknown>
  extra: Record<string, unknown>
  doc?: Doc
  edits?: Record<string, string>
  baseKey?: string
}
```

The `extra` bag is shared across all hooks within a single document pass, allowing `beforeParse` to pass parsed ASTs or frontmatter structures directly to `parseTitle`, `afterParse`, or emission hooks.

---

## Parser / Importer Hooks

### `beforeParse({ raw, filePath, projectName, file, config, extra })`
Runs before any document parsing starts.
- **Return**: `string` (modified markdown raw text) OR `{ raw?: string, [key: string]: unknown }` to attach custom data to `extra`.
- **Use case**: Stripping YAML frontmatter, pre-processing custom macros, normalizing indentation.

### `parseTitle({ raw, lines, title, subtitle, extra })`
Runs during title and subtitle extraction.
- **Return**: `{ title?: string, subtitle?: string } | void`.
- **Use case**: Extracting title and subtitle from YAML metadata instead of Markdown headings.

### `parseSummaryTable({ lines, raw, config, extra })`
Runs during summary table detection.
- **Return**: `{ startLine: number, endLine: number, entries: Array<{ num: string, tema: string, estado: string }>, headers?: string[] } | null | void`.
- **Use case**: Parsing tables with non-standard columns (`Task | Assignee | Status`, `Tarea | Responsable | Estado`).

### `parseSections({ lines, raw, config, extra })`
Runs during section splitting.
- **Return**: `Array<DocSection> | null | void`.
- **Use case**: Splitting on alternative delimiters (e.g. H3 tags, custom separators, folded blocks).

### `detectStatus({ text, config, extra })`
Runs per section or text block.
- **Return**: `Array<{ key: string }> | string[] | null | void`.
- **Use case**: Detecting status from GitHub checklist boxes (`- [x]` -> `done`, `- [/]` -> `progress`, `- [ ]` -> `pending`) or inline directives (`@status(done)`).

### `afterParse({ doc, extra, filePath, projectName, file, config })`
Runs after the `Doc` object is assembled.
- **Return**: `Doc | void`.
- **Use case**: Attaching custom metadata (`doc.frontmatter`, `doc.metadata`), adjusting computed metrics.

---

## Emitter / Exporter Hooks

### `beforeEmit({ doc, edits, baseKey, config, extra })`
Runs prior to document reassembly.
- **Return**: `void`.

### `emitSummaryTable({ summary, doc, edits, baseKey, config, extra })`
Custom serializer for summary tables.
- **Return**: `string | null | void`.
- **Use case**: Formatting markdown tables with custom column alignments or custom headers.

### `emitSection({ section, raw, doc, edits, baseKey, config, extra })`
Custom serializer for an individual section.
- **Return**: `string | null | void`.

### `afterEmit({ markdown, doc, edits, baseKey, config, extra })`
Runs after the document has been fully assembled into a markdown string.
- **Return**: `string | void`.
- **Use case**: Re-attaching frontmatter headers (`--- ... ---`), re-formatting whitespace or dialect syntax.

---

## Built-in Plugins

### 1. `scripts/plugins/frontmatter.mjs`
- Extracts YAML frontmatter blocks bounded by `---` at the beginning of files.
- Attaches parsed properties to `doc.frontmatter` and `doc.metadata`.
- Derives title and subtitle from frontmatter keys when present.
- Re-injects frontmatter during document emission (`afterEmit`).

### 2. `scripts/plugins/custom-tables.mjs`
- Parses tables with arbitrary headers containing topic/task and status columns.
- Normalizes column variants: `Task`, `Tarea`, `Feature`, `Component`, `Assignee`, `Responsable`, `State`, `Estado`, `Progreso`.
- Re-emits custom formatted markdown tables preserving custom column headers.

### 3. `scripts/plugins/dialects.mjs`
- Detects statuses from markdown checklists:
  - `- [x]` / `* [x]` -> `done`
  - `- [/]` / `* [/]` / `[-]` -> `progress`
  - `- [ ]` / `* [ ]` -> `pending`
- Detects inline status directives: `@status(done)`, `status:: done`.

---

## Configuration via `mdboard.json`

Plugins can be enabled, disabled, or configured globally or per-project in `mdboard.json`:

```json
{
  "plugins": {
    "frontmatter": {
      "enabled": true,
      "priority": 100
    },
    "custom-tables": {
      "enabled": true,
      "priority": 50
    },
    "dialects": {
      "enabled": true,
      "priority": 25
    }
  }
}
```

---

## Example: Creating a Custom Plugin

Create a new file `scripts/plugins/my-importer.mjs`:

```javascript
/**
 * Custom importer plugin for Sprint markdown files.
 */
export default {
  name: 'sprint-importer',
  priority: 80,
  projects: ['sprint-tracker'],

  parseTitle({ lines }) {
    for (const line of lines) {
      if (line.startsWith('Sprint:')) {
        return {
          title: line.replace('Sprint:', '').trim(),
          subtitle: 'Active Sprint Tracker',
        }
      }
    }
  },

  detectStatus({ text }) {
    if (text.includes('[COMPLETED]')) return [{ key: 'done' }]
    if (text.includes('[BLOCKED]')) return [{ key: 'pending' }]
    return null
  },
}
```
