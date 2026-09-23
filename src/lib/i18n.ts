export type Lang = 'en' | 'es'

export type T = (key: string, vars?: Record<string, string | number>) => string

const DICT: Record<string, { en: string; es: string }> = {
  // search / filter
  'search.placeholder': { en: 'Search sections…', es: 'Buscar secciones…' },
  'filter.all': { en: 'All', es: 'Todos' },
  'filter.click': { en: 'Click to filter', es: 'Clic para filtrar' },
  // views
  'view.board': { en: '⧉ Board', es: '⧉ Tablero' },
  'view.canvas': { en: '◧ Canvas', es: '◧ Canvas' },
  'view.board.title': { en: 'Board view', es: 'Vista tablero' },
  'view.canvas.title': { en: 'Figma-like canvas', es: 'Canvas estilo Figma' },
  'readmode.title': { en: 'Focus / reading mode', es: 'Modo lectura / foco' },
  'font.title': { en: 'Font size', es: 'Tamaño de letra' },
  'lang.title': { en: 'Language: Español', es: 'Language: English' },
  // topbar actions
  'top.copy': { en: '📋 Copy', es: '📋 Copiar' },
  'top.copy.title': { en: 'Copy full markdown', es: 'Copiar markdown completo' },
  'top.save': { en: '💾 Save', es: '💾 Guardar' },
  'top.save.title': { en: 'Write the whole document to its .md file', es: 'Escribir el doc completo en su archivo .md' },
  'top.export': { en: '⬇️ Export', es: '⬇️ Exportar' },
  'top.export.title': { en: 'Download .md', es: 'Descargar .md' },
  'top.reset': { en: '↺ Reset', es: '↺ Reset' },
  'top.reset.title': { en: 'Discard local edits', es: 'Descartar ediciones locales' },
  'top.reset.confirm': {
    en: 'Discard all local edits and go back to the original .md files?',
    es: '¿Descartar todas tus ediciones locales y volver a los .md originales?',
  },
  'top.app': { en: 'App', es: 'App' },
  'top.app.title': { en: 'App & web previews', es: 'Preview de app y web' },
  'preview.web': { en: 'Web', es: 'Web' },
  'top.theme.title': { en: 'Toggle theme', es: 'Cambiar tema' },
  // toasts
  'toast.downloaded': { en: 'Markdown file downloaded ⬇️', es: 'Archivo .md descargado ⬇️' },
  'toast.copied': { en: 'Full markdown copied 📋', es: 'Markdown completo copiado 📋' },
  'toast.reset': { en: 'Local edits discarded', es: 'Ediciones locales descartadas' },
  'toast.undo': { en: 'Undo', es: 'Deshacer' },
  'toast.sectionSaved': { en: 'Section saved and written to the .md ✓', es: 'Sección guardada y escrita en el .md ✓' },
  'toast.sectionSavedLocal': { en: 'Section saved (local) ✓', es: 'Sección guardada (local) ✓' },
  'toast.fileWritten': { en: 'Saved to the real file ✓', es: 'Guardado en el archivo real ✓' },
  'toast.fileLocal': {
    en: 'Saved locally (serve with `npm run dev` to persist)',
    es: 'Guardado solo en local (servir con `npm run dev`)',
  },
  'toast.codeCopied': { en: 'Code copied 📋', es: 'Código copiado 📋' },
  'toast.copyFail': { en: 'Could not copy', es: 'No se pudo copiar' },
  'toast.sectionCopied': { en: 'Section copied 📋', es: 'Sección copiada 📋' },
  'toast.canvasReset': { en: 'Canvas layout reset', es: 'Layout del canvas restablecido' },
  // sidebar
  'sidebar.foot.hint': {
    en: 'Docs are read live from each project. Edit here (writes to the real .md) or tweak the files and run `npm run sync` to refresh.',
    es: 'Los docs se leen en vivo de cada proyecto. Editalo acá (guarda en el .md real) o tocá los archivos y corré `npm run sync` para refrescar.',
  },
  // editor
  'editor.placeholder': { en: '# Write markdown…', es: '# Escribí markdown…' },
  'editor.hint': { en: 'Ctrl/⌘+Enter save · Esc cancel', es: 'Ctrl/⌘+Enter guardar · Esc cancelar' },
  'editor.save': { en: 'Save', es: 'Guardar' },
  'editor.cancel': { en: 'Cancel', es: 'Cancelar' },
  'editor.toolbar.label': { en: 'Formatting', es: 'Formato' },
  'editor.toolbar.bold': { en: 'Bold', es: 'Negrita' },
  'editor.toolbar.italic': { en: 'Italic', es: 'Cursiva' },
  'editor.toolbar.strike': { en: 'Strikethrough', es: 'Tachado' },
  'editor.toolbar.code': { en: 'Inline code', es: 'Código en línea' },
  'editor.toolbar.link': { en: 'Link', es: 'Enlace' },
  'editor.toolbar.bullet': { en: 'Bullet list', es: 'Lista de puntos' },
  'editor.toolbar.number': { en: 'Numbered list', es: 'Lista numerada' },
  'editor.toolbar.quote': { en: 'Quote', es: 'Cita' },
  // cards
  'card.edited.title': { en: 'Edited here', es: 'Modificado aquí' },
  'card.expand': { en: 'Expand', es: 'Expandir' },
  'card.collapse': { en: 'Collapse', es: 'Colapsar' },
  'card.copySection': { en: 'Copy section', es: 'Copiar sección' },
  'card.editSection': { en: 'Edit section', es: 'Editar sección' },
  'card.restore': { en: 'Restore original', es: 'Restaurar original' },
  'card.editIntro': { en: '✏️ Edit intro', es: '✏️ Editar intro' },
  'card.lines': { en: '{n} lines', es: '{n} líneas' },
  'card.items': { en: '{n} items', es: '{n} ítems' },
  'summary.title': { en: 'Status summary', es: 'Resumen de estado' },
  'board.collapseAll': { en: 'Collapse all', es: 'Colapsar todo' },
  'board.expandAll': { en: 'Expand all', es: 'Expandir todo' },
  'board.hint': { en: 'Double-click a header to collapse · ⌘K search', es: 'Doble clic en el título: colapsar · ⌘K buscar' },
  // tour
  'tour.skip': { en: 'Skip tour', es: 'Saltar tour' },
  'tour.next': { en: 'Next', es: 'Siguiente' },
  'tour.done': { en: 'Done', es: 'Listo' },
  'tour.step1.title': { en: 'Search & filter', es: 'Buscá y filtrá' },
  'tour.step1.body': {
    en: 'Filter docs by text or status. Press Ctrl/⌘+K to jump to the search box.',
    es: 'Filtrá los docs por texto o estado. Presioná Ctrl/⌘+K para ir a la búsqueda.',
  },
  'tour.step2.title': { en: 'Edit any section', es: 'Editá cualquier sección' },
  'tour.step2.body': {
    en: 'Click ✏️ to edit a section in place, with formatting buttons. Changes are written back to the real .md file.',
    es: 'Tocá ✏️ para editar una sección en el lugar, con botones de formato. Los cambios se guardan en el .md real.',
  },
  'tour.step3.title': { en: 'Save the file', es: 'Guardá el archivo' },
  'tour.step3.body': {
    en: '💾 Save writes the whole document back to the project. Use ↺ Reset (undo included) to discard changes.',
    es: '💾 Guardar escribe el documento completo en el proyecto. Usá ↺ Reset (con deshacer) para descartar cambios.',
  },
  'tour.step4.title': { en: 'Board or Canvas', es: 'Tablero o Canvas' },
  'tour.step4.body': {
    en: '⧉ Board lists sections as cards; ◧ Canvas gives you a Figma-like board you can rearrange freely.',
    es: '⧉ Tablero lista las secciones como tarjetas; ◧ Canvas te da un tablero estilo Figma que podés reacomodar.',
  },
  // empty / canvas
  'empty.selectDoc': { en: 'Pick a document from the left menu.', es: 'Cargá un documento desde el menú izquierdo.' },
  'empty.noSearch': { en: 'No sections match "{q}".', es: 'No hay secciones que matcheen "{q}".' },
  'empty.noStatus': { en: 'No sections with that status.', es: 'No hay secciones con este estado.' },
  'empty.canvas': { en: 'Pick a document to use the canvas.', es: 'Cargá un documento para usar el canvas.' },
  'canvas.note': {
    en: '∞ Drag cards to arrange · drag the background to move · wheel to zoom',
    es: '∞ Arrastrá las cards para ordenarlas · fondo para moverte · rueda para zoom',
  },
  'canvas.fit': { en: '⤢ Fit', es: '⤢ Ajustar' },
  'canvas.view': { en: '⟲ View', es: '⟲ Vista' },
  'canvas.reset': { en: '⟳ Reset', es: '⟳ Reset' },
  'canvas.position': { en: '⟲ Position', es: '⟲ Posición' },
  'canvas.position.title': { en: 'Back to default position', es: 'Volver a la posición por defecto' },
  // inspector
  'inspector.close': { en: 'Close inspector', es: 'Cerrar inspector' },
  'inspector.section': { en: 'Section', es: 'Sección' },
  'inspector.type': { en: 'type: {type}', es: 'tipo: {type}' },
  'inspector.markdown': { en: 'Markdown', es: 'Markdown' },
  'inspector.preview': { en: 'Preview', es: 'Preview' },
  'inspector.copy': { en: '📋 Copy', es: '📋 Copiar' },
  'inspector.restore': { en: '↺ Restore', es: '↺ Restaurar' },
  'inspector.save': { en: 'Save', es: 'Guardar' },
  // phone mock chrome
  'mock.side.title': { en: 'App-style preview ·', es: 'Preview estilo app ·' },
  'mock.side.desc': {
    en: 'Config-driven app look per project (set in `mdboard.json` / `mdboard.local.json`).',
    es: 'Preview configurable de apariencia app por proyecto (dato configurado en `mdboard.json` / `mdboard.local.json`).',
  },
  'mock.close': { en: '✕ Close preview', es: '✕ Cerrar preview' },
  'mock.empty': {
    en: 'No preview for {project}. Define it in apps → mdboard config.',
    es: 'Sin preview para {project}. Definilo en apps → mdboard config.',
  },
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const entry = DICT[key]
  let out = entry?.[lang] ?? entry?.en ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}