import { useMemo, useState } from 'react'
import type { AdrRecord } from '../../lib/adrs'
import { adrStatus, ADR_INTRO_MARK } from '../../lib/adrs'
import { cleanHeading, Markdown, EditorBox, EditedDot } from '../Cards'
import { useApp } from '../../state/AppContext'

const REL_ICON: Record<string, string> = {
  supersedes: '➡️',
  superseded_by: '⬅️',
  related_to: '🔗',
  depends_on: '🧩',
}

export function DecisionCard({
  rec,
  supersededBy,
}: {
  rec: AdrRecord
  /** ids que supersedean a este ADR (para la alerta en contexto). */
  supersededBy?: string[]
}) {
  const { t, adrEdits, setAdrEdits, writeAdrSection } = useApp()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const status = adrStatus(rec)
  const superseded = supersededBy && supersededBy.length > 0

  const toggle = (id: string) => setOpenSections((o) => ({ ...o, [id]: !o[id] }))

  const keyFor = (id: string) => (id === ADR_INTRO_MARK ? ADR_INTRO_MARK : id)

  const rawFor = (id: string) => {
    const k = `${rec.project}\u241F${rec.file}\u241E${id}`
    return adrEdits[k] ?? (id === ADR_INTRO_MARK ? rec.intro : rec.sections.find((s) => s.id === id)?.raw ?? '')
  }
  const editedFor = (id: string) => {
    const k = `${rec.project}\u241F${rec.file}\u241E${id}`
    return k in adrEdits
  }

  const save = (id: string) => {
    writeAdrSection(rec, keyFor(id), draft)
    setEditing(null)
  }
  const restore = (id: string) => {
    const k = `${rec.project}\u241F${rec.file}\u241E${id}`
    setAdrEdits((prev) => {
      const next = { ...prev }
      delete next[k]
      return next
    })
  }

  const badgeReady = useMemo(() => superseded || rec.broken.length > 0, [superseded, rec.broken])

  return (
    <article className={`card adr-card${badgeReady ? ' adr-flagged' : ''}`}>
      <header className="card-head" onDoubleClick={() => toggle('__head')}>
        <button type="button" className="btn-icon collapse" onClick={() => toggle('__head')} aria-label="collapse">
          {openSections['__head'] ? '▸' : '▾'}
        </button>
        <h3 className="card-title">
          <span className="card-index">{rec.id}</span>
          {cleanHeading(rec.title)}
        </h3>
        <div className="card-meta">
          <span className={`chip chip-adr-${rec.status}`}>
            {status.emoji} {status.label}
          </span>
          {rec.date && <span className="lno">{rec.date}</span>}
          <span className="lno">{rec.file}</span>
        </div>
      </header>

      <div className="adr-relations">
        {superseded && (
          <span className="adr-badge adr-badge-alert" title={t('adr.replacedBy')}>
            {t('adr.replacedBy')} {supersededBy?.join(', ')}
          </span>
        )}
        {rec.relations.map((rel, i) => (
          <span key={i} className={`adr-badge badge-${rel.type}`}>
            {REL_ICON[rel.type] ?? '•'} {rel.type} <code>{rel.targetId}</code>
          </span>
        ))}
        {rec.broken.map((b, i) => (
          <span key={`b${i}`} className="adr-badge adr-badge-broken">
            {t('adr.broken')} <code>{b}</code>
          </span>
        ))}
      </div>

      <div className="card-body">
        {openSections['__head'] && (
          <>
            <div className="adr-intro">
              <div className="adr-head-row">
                <span className="adr-intro-label">{t('adr.metadata')}</span>
                <button type="button" className="btn ghost xs" onClick={() => { setDraft(rawFor(ADR_INTRO_MARK)); setEditing(ADR_INTRO_MARK) }}>
                  ✏️ {t('card.editIntro')}
                </button>
              </div>
              {editedFor(ADR_INTRO_MARK) && (
                <button type="button" className="btn ghost xs" onClick={() => restore(ADR_INTRO_MARK)}>
                  {t('card.restore')}
                </button>
              )}
              {editing === ADR_INTRO_MARK ? (
                <EditorBox value={draft} onChange={setDraft} onSave={() => save(ADR_INTRO_MARK)} onCancel={() => setEditing(null)} />
              ) : (
                <Markdown md={rawFor(ADR_INTRO_MARK)} />
              )}
            </div>
            {rec.sections.map((section) => {
              const open = openSections[section.id] ?? false
              const edited = editedFor(section.id)
              return (
                <section key={section.id} className="adr-section">
                  <div className="adr-head-row">
                    <span className="adr-section-head">{open ? '▾' : '▸'} {cleanHeading(section.heading)}</span>
                    <span className="card-meta">
                      <EditedDot edited={edited} />
                      <span className="lno">L{section.startLine}</span>
                    </span>
                    <button type="button" className="btn-icon" onClick={() => toggle(section.id)} aria-label={t('card.expand')}>
                      {open ? '▸' : '▾'}
                    </button>
                    <button type="button" className="btn ghost xs" onClick={() => { setDraft(rawFor(section.id)); setEditing(section.id) }}>
                      ✏️
                    </button>
                  </div>
                  {edited && (
                    <button type="button" className="btn ghost xs" onClick={() => restore(section.id)}>
                      {t('card.restore')}
                    </button>
                  )}
                  {open && (editing === section.id ? (
                    <EditorBox value={draft} onChange={setDraft} onSave={() => save(section.id)} onCancel={() => setEditing(null)} />
                  ) : (
                    <Markdown md={rawFor(section.id)} />
                  ))}
                </section>
              )
            })}
          </>
        )}
        {!openSections['__head'] && (
          <div className="adr-preview">
            <Markdown md={rec.sections.find((s) => s.heading.toLowerCase() === 'decision')?.raw ?? rec.intro} />
          </div>
        )}
      </div>
    </article>
  )
}