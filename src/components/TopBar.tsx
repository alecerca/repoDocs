import { useApp } from '../state/AppContext'
import { assembleRaw } from '../lib/registry'
import { typeDocFile, DOC_TYPE_ICON } from '../lib/registry'
import { STATUS_META, APPS } from '../lib/config'
import { toast } from '../lib/toast'
import type { DocStatus } from '../generated/docs'

export function TopBar() {
  const {
    activeProject,
    activeDoc,
    current,
    baseKey,
    edits,
    resetEdits,
    hasEdits,
    view,
    setView,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    statusCounts,
    fontScale,
    setFontScale,
    theme,
    toggleTheme,
    previewOpen,
    setPreviewOpen,
    saveCurrentToFile,
  } = useApp()

  const totalStatus = statusCounts.done + statusCounts.pending + statusCounts.progress

  const exportDoc = () => {
    if (!current) return
    const md = assembleRaw(current, edits, baseKey)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${current.project}__${current.file}`
    a.click()
    URL.revokeObjectURL(url)
    toast('Archivo .md descargado ⬇️')
  }

  const copyDoc = () => {
    if (!current) return
    const md = assembleRaw(current, edits, baseKey)
    void navigator.clipboard?.writeText(md).then(() => toast('Markdown completo copiado 📋'))
  }

  const docType = typeDocFile(activeDoc)

  return (
    <header className="topbar">
      <div className="crumb">
        <span className="crumb-project">{activeProject}</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-doc">
          {DOC_TYPE_ICON[docType]} {activeDoc}
        </span>
      </div>

      <div className="top-actions">
        <input
          className="search"
          type="search"
          placeholder="Buscar secciones…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {totalStatus > 0 && (
          <div className="chip-filter" role="group">
            <button
              type="button"
              className={`fchip${statusFilter === 'all' ? ' on' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </button>
            <FilterChip status="done" count={statusCounts.done} current={statusFilter} set={setStatusFilter} />
            <FilterChip status="pending" count={statusCounts.pending} current={statusFilter} set={setStatusFilter} />
            <FilterChip status="progress" count={statusCounts.progress} current={statusFilter} set={setStatusFilter} />
          </div>
        )}

        <div className="view-toggle">
          <button
            type="button"
            className={view === 'board' ? 'on' : ''}
            onClick={() => setView('board')}
            title="Vista tablero"
          >
            ⧉ Tablero
          </button>
          <button
            type="button"
            className={view === 'canvas' ? 'on' : ''}
            onClick={() => setView('canvas')}
            title="Canvas estilo Figma"
          >
            ◧ Canvas
          </button>
        </div>

        <div className="font-ctrl" title="Tamaño de letra">
          <button className="btn-icon" onClick={() => setFontScale(fontScale - 10)}>A−</button>
          <span>{fontScale}%</span>
          <button className="btn-icon" onClick={() => setFontScale(fontScale + 10)}>A+</button>
        </div>

        <button type="button" className="btn ghost sm" onClick={copyDoc} disabled={!current} title="Copiar markdown completo">
          📋 Copiar
        </button>
        <button
          type="button"
          className="btn primary sm"
          onClick={saveCurrentToFile}
          disabled={!current}
          title="Escribir el doc completo en su archivo .md"
        >
          💾 Guardar
        </button>
        <button type="button" className="btn ghost sm" onClick={exportDoc} disabled={!current} title="Descargar .md">
          ⬇️ Exportar
        </button>
        {hasEdits && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              if (window.confirm('¿Descartar todas tus ediciones locales y volver a los .md originales?')) {
                resetEdits()
                toast('Ediciones locales descartadas')
              }
            }}
            title="Descartar ediciones locales"
          >
            ↺ Reset
          </button>
        )}

        {APPS.length > 0 && (
          <button
            type="button"
            className={`btn ghost sm${previewOpen ? ' pressed' : ''}`}
            onClick={() => setPreviewOpen(!previewOpen)}
            title="Preview estilo app"
          >
            📱<span className="preview-label">App</span>
          </button>
        )}

        <button type="button" className="btn-icon" onClick={toggleTheme} title="Cambiar tema">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
      {current && <small className="topbar-path">{current.path}</small>}
    </header>
  )
}

function FilterChip({
  status,
  count,
  current,
  set,
}: {
  status: DocStatus
  count: number
  current: string | 'all' | DocStatus
  set: (s: 'all' | DocStatus) => void
}) {
  const meta = STATUS_META.find((s) => s.key === status)
  return (
    <button
      type="button"
      className={`fchip chip-${status}${current === status ? ' on' : ''}`}
      onClick={() => set(current === status ? 'all' : status)}
      disabled={count === 0}
      title={meta?.plural ?? status}
    >
      {meta?.emoji ?? status} {count}
    </button>
  )
}