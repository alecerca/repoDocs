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
    setGithubModalOpen,
    remoteRepo,
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
        <button
          type="button"
          className={`btn ghost sm github-top-btn${remoteRepo ? ' has-repo' : ''}`}
          onClick={() => setGithubModalOpen(true)}
          title={t('github.button.title')}
        >
          <svg className="github-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span>{remoteRepo ? `${remoteRepo.repo}` : t('github.button')}</span>
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