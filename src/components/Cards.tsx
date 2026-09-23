import { useMemo, useState, type ReactNode } from 'react'
import type { Doc, DocSection } from '../lib/registry'
import { sectionKey, INTRO_MARK, type EditsMap } from '../lib/registry'
import { renderMarkdown, type StatusKey } from '../lib/markdown'
import { brandFor } from '../lib/palette'
import { STATUS_META as STATUS_CONFIG } from '../lib/config'
import { toast } from '../lib/toast'
import { useApp } from '../state/AppContext'

export function cleanHeading(h: string): string {
  return h.replace(/[*`[\]()]/g, '').trim()
}

const STATUS_META: Record<StatusKey, { label: string; emoji: string }> = Object.fromEntries(
  STATUS_CONFIG.map((s) => [s.key, { label: s.label, emoji: s.emoji }])
) as Record<StatusKey, { label: string; emoji: string }>

export function StatusChip({ status }: { status: StatusKey | null }) {
  if (!status) return null
  const meta = STATUS_META[status]
  return (
    <span className={`chip chip-${status}`} title={meta.label}>
      {meta.emoji} {meta.label}
    </span>
  )
}

export function EditedDot({ edited }: { edited: boolean }) {
  const { t } = useApp()
  if (!edited) return null
  return <span className="edited-dot" title={t('card.edited.title')} />
}

export function Markdown({ md }: { md: string }) {
  const { t } = useApp()
  const html = useMemo(() => renderMarkdown(md), [md])
  const onContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest?.('.code-copy')
    if (btn) {
      const pre = btn.parentElement?.querySelector('pre')
      if (pre) {
        void navigator.clipboard?.writeText(pre.innerText.replace(/\n$/, '')).then(
          () => toast(t('toast.codeCopied')),
          () => toast(t('toast.copyFail'))
        )
      }
    }
  }
  return (
    <div
      className="md"
      key={html.length}
      onClick={onContainerClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function EditorBox({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const { t } = useApp()
  return (
    <div className="editor">
      <textarea
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={t('editor.placeholder')}
      />
      <div className="editor-bar">
        <span className="editor-hint">{t('editor.hint')}</span>
        <div>
          <button className="btn ghost" onClick={onCancel}>
            {t('editor.cancel')}
          </button>
          <button className="btn primary sm" onClick={onSave}>
            {t('editor.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SectionCard({
  section,
  edits,
  baseKey,
  writeSection,
}: {
  section: DocSection
  edits: EditsMap
  baseKey: string
  writeSection: (baseKey: string, key: string, raw: string) => void
}) {
  const { t } = useApp()
  const key = sectionKey(baseKey, section.id)
  const raw = edits[key] ?? section.raw
  const edited = key in edits
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    setDraft(raw)
    setEditing(true)
  }
  const save = () => {
    writeSection(baseKey, section.id, draft)
    setEditing(false)
  }
  const copySection = () => {
    void navigator.clipboard?.writeText(raw).then(() => toast(t('toast.sectionCopied')))
  }

  return (
    <article className={`card${collapsed ? ' collapsed' : ''}${edited ? ' edited' : ''}`} data-sid={section.id}>
      <header className="card-head" onDoubleClick={() => setCollapsed((c) => !c)}>
        <button
          type="button"
          className="btn-icon collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? t('card.expand') : t('card.collapse')}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <h3 className="card-title">
          <span className="card-index">{section.id.replace(/-.*$/, '')}</span>
          {cleanHeading(section.heading ?? section.raw.replace(/^#{1,3}\s*/, '').split('\n')[0])}
        </h3>
        <div className="card-meta">
          <StatusChip status={section.status} />
          <EditedDot edited={edited} />
          <span className="lno">L{section.startLine}</span>
        </div>
        <button type="button" className="btn-icon" onClick={copySection} aria-label={t('card.copySection')}>
          📋
        </button>
        <button type="button" className="btn-icon" onClick={startEdit} aria-label={t('card.editSection')}>
          ✏️
        </button>
      </header>
      {!collapsed && (
        <div className="card-body">
          {editing ? (
            <EditorBox
              value={draft}
              onChange={setDraft}
              onSave={save}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <Markdown md={raw} />
          )}
        </div>
      )}
    </article>
  )
}

export function IntroCard({
  doc,
  edits,
  baseKey,
  writeSection,
}: {
  doc: Doc
  edits: EditsMap
  baseKey: string
  writeSection: (baseKey: string, key: string, raw: string) => void
}) {
  const { t } = useApp()
  const key = sectionKey(baseKey, INTRO_MARK)
  const raw = edits[key] ?? doc.intro
  const edited = key in edits
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const brand = brandFor(doc.project)

  return (
    <article className={`card intro${edited ? ' edited' : ''}`}>
      <header className="card-head">
        <span className="intro-avatar">{doc.project.slice(0, 1)}</span>
        <div className="intro-titles">
          <h1 className="doc-title">{doc.title}</h1>
          {doc.subtitle && <p className="doc-subtitle">{doc.subtitle}</p>}
        </div>
        <div className="card-meta">
          <span className="file-badge">{doc.file}</span>
          <span className="lno">{t('card.lines', { n: doc.lines })}</span>
          <span className="lno mono">{doc.sha.slice(0, 7)}</span>
          <EditedDot edited={edited} />
        </div>
      </header>
      <div className="card-body">
        {doc.project && (
          <div className="intro-tags">
            {brand.stack.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        )}
        {editing ? (
          <EditorBox
            value={draft}
            onChange={setDraft}
            onSave={() => {
              writeSection(baseKey, INTRO_MARK, draft)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <Markdown md={raw} />
        )}
      </div>
      <footer className="card-foot">
        <button type="button" className="btn ghost xs" onClick={() => { setDraft(raw); setEditing(true) }}>
          {t('card.editIntro')}
        </button>
        <span className="foot-path" title={doc.path}>
          {doc.path}
        </span>
      </footer>
    </article>
  )
}

export function SummaryCard({ doc }: { doc: Doc }) {
  const { t } = useApp()
  if (!doc.summary || doc.summary.entries.length === 0) return null
  return (
    <article className="card summary">
      <header className="card-head">
        <h3 className="card-title">{t('summary.title')}</h3>
        <span className="card-meta">
          <span className="lno">{t('card.items', { n: doc.summary.entries.length })}</span>
        </span>
      </header>
      <div className="summary-grid">
        {doc.summary.entries.map((entry, i) => {
          const key = detectEntryStatus(entry.estado)
          return (
            <div className="summary-row" key={`${entry.num}-${i}`}>
              <span className="summary-num">{entry.num}</span>
              <span className="summary-tema">{entry.tema}</span>
              <span className={`chip chip-${key ?? 'none'}`}>{entry.estado}</span>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function detectEntryStatus(estado: string): StatusKey | null {
  const e = estado.toLowerCase()
  if (/completad/.test(e)) return 'done'
  if (/progreso|proceso/.test(e)) return 'progress'
  if (/pendiente/.test(e)) return 'pending'
  return null
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}