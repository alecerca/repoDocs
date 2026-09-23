import { useApp } from '../state/AppContext'
import { assembleRaw } from '../lib/registry'
import { typeDocFile, DOC_TYPE_ICON } from '../lib/registry'
import { STATUS_META, statusMetaForDoc, APPS, type StatusMeta } from '../lib/config'
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
    readMode,
    setReadMode,
    theme,
    toggleTheme,
    previewOpen,
    setPreviewOpen,
    saveCurrentToFile,
    lang,
    setLang,
    t,
  } = useApp()

  const docStatuses = statusMetaForDoc(current)
  const totalStatus = Object.values(statusCounts).reduce((a, b) => a + (b || 0), 0)

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
    toast(t('toast.downloaded'))
  }

  const copyDoc = () => {
    if (!current) return
    const md = assembleRaw(current, edits, baseKey)
    void navigator.clipboard?.writeText(md).then(() => toast(t('toast.copied')))
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
          id="global-search"
          className="search"
          type="search"
          placeholder={t('search.placeholder')}
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
              {t('filter.all')}
            </button>
            {docStatuses.map((meta) => (
              <FilterChip
                key={meta.key}
                status={meta.key}
                count={statusCounts[meta.key] ?? 0}
                current={statusFilter}
                set={setStatusFilter}
                meta={meta}
              />
            ))}
          </div>
        )}

        <div className="view-toggle">
          <button
            type="button"
            className={view === 'board' ? 'on' : ''}
            onClick={() => setView('board')}
            title={t('view.board.title')}
          >
            {t('view.board')}
          </button>
          <button
            type="button"
            className={view === 'canvas' ? 'on' : ''}
            onClick={() => setView('canvas')}
            title={t('view.canvas.title')}
          >
            {t('view.canvas')}
          </button>
        </div>

        <div className="font-ctrl" title={t('font.title')}>
          <button className="btn-icon" onClick={() => setFontScale(fontScale - 10)}>A−</button>
          <span>{fontScale}%</span>
          <button className="btn-icon" onClick={() => setFontScale(fontScale + 10)}>A+</button>
        </div>

        <button
          type="button"
          className={`btn-icon${readMode ? ' on' : ''}`}
          onClick={() => setReadMode(!readMode)}
          title={t('readmode.title')}
          aria-label={t('readmode.title')}
        >
          {readMode ? '👓' : '📖'}
        </button>

        <div className="lang-toggle" title={t('lang.title')}>
          <button
            type="button"
            className={lang === 'en' ? 'on' : ''}
            onClick={() => setLang('en')}
            aria-label="English"
          >
            EN
          </button>
          <button
            type="button"
            className={lang === 'es' ? 'on' : ''}
            onClick={() => setLang('es')}
            aria-label="Español"
          >
            ES
          </button>
        </div>

        <button type="button" className="btn ghost sm" onClick={copyDoc} disabled={!current} title={t('top.copy.title')}>
          {t('top.copy')}
        </button>
        <button
          type="button"
          className="btn primary sm"
          onClick={saveCurrentToFile}
          disabled={!current}
          title={t('top.save.title')}
        >
          {t('top.save')}
        </button>
        <button type="button" className="btn ghost sm" onClick={exportDoc} disabled={!current} title={t('top.export.title')}>
          {t('top.export')}
        </button>
        {hasEdits && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              if (window.confirm(t('top.reset.confirm'))) {
                resetEdits()
                toast(t('toast.reset'))
              }
            }}
            title={t('top.reset.title')}
          >
            {t('top.reset')}
          </button>
        )}

        {APPS.length > 0 && (
          <button
            type="button"
            className={`btn ghost sm${previewOpen ? ' pressed' : ''}`}
            onClick={() => setPreviewOpen(!previewOpen)}
            title={t('top.app.title')}
          >
            📱<span className="preview-label">{t('top.app')}</span>
          </button>
        )}

        <button type="button" className="btn-icon" onClick={toggleTheme} title={t('top.theme.title')}>
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
  meta,
}: {
  status: DocStatus
  count: number
  current: string | 'all' | DocStatus
  set: (s: 'all' | DocStatus) => void
  meta?: StatusMeta
}) {
  const m = meta ?? STATUS_META.find((s) => s.key === status)
  return (
    <button
      type="button"
      className={`fchip chip-${status}${current === status ? ' on' : ''}`}
      onClick={() => set(current === status ? 'all' : status)}
      disabled={count === 0}
      title={m?.plural ?? status}
    >
      {m?.emoji ?? status} {count}
    </button>
  )
}