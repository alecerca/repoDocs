# repoDocs Plugins

This directory contains importer and emitter plugins for repoDocs.

Any `.mjs` file in this directory (except test files matching `*.test.mjs` or files starting with `.` or `_`) is automatically discovered and loaded by `scripts/plugins.mjs`.

## Included Plugins

| Plugin | File | Purpose | Priority |
| --- | --- | --- | --- |
| Frontmatter | `frontmatter.mjs` | Parses YAML frontmatter headers, maps metadata, extracts title/subtitle, and re-emits YAML fences | 100 |
| Custom Tables | `custom-tables.mjs` | Recognizes arbitrary summary table column headers (`Task`, `Assignee`, `Status`, `Tarea`, etc.) | 50 |
| Dialects | `dialects.mjs` | Detects task list status markers (`- [x]`, `- [/]`, `- [ ]`) and inline directives (`@status(done)`) | 25 |

## Plugin Anatomy

```javascript
/**
 * Example plugin definition.
 */
export default {
  name: 'my-custom-plugin',
  version: '1.0.0',
  priority: 10,
  
  // Optional project/file filters
  projects: ['my-project'], // or /regex/ or match(context)
  
  // Parser / Importer Hooks
  beforeParse({ raw, filePath, projectName, file, config, extra }) {},
  parseTitle({ lines, extra }) {},
  parseSummaryTable({ lines }) {},
  parseSections({ lines }) {},
  detectStatus({ text }) {},
  afterParse({ doc, extra }) {},

  // Emitter / Exporter Hooks
  beforeEmit({ doc, edits }) {},
  emitSummaryTable({ summary }) {},
  emitSection({ section, raw }) {},
  afterEmit({ markdown, doc }) {},
}
```

For comprehensive documentation of the hook contracts and lifecycle, see [`docs/PLUGINS.md`](../../docs/PLUGINS.md).
