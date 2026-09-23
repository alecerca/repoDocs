import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useApp } from '../state/AppContext'
import type { CanvasLayout } from '../lib/registry'
import { newSectionDefaults } from './canvasLayout'
import { IntroCard, SummaryCard, SectionCard, EmptyState, Markdown, cleanHeading } from './Cards'
import { toast } from '../lib/toast'

// ---------- BOARD ----------

export function BoardView() {
  const { current, edits, writeSection, search, statusFilter, t } = useApp()

  const filtered = useMemo(() => {
    if (!current) return []
    const q = search.trim().toLowerCase()
    return current.sections
      .filter((s) => s.kind !== 'summary')
      .filter((s) => {
        const text = `${s.heading ?? ''} ${s.raw}`
        if (q && !text.toLowerCase().includes(q)) return false
        if (statusFilter !== 'all' && s.status !== statusFilter) return false
        return true
      })
  }, [current, search, statusFilter])

  if (!current) {
    return <EmptyState>{t('empty.selectDoc')}</EmptyState>
  }

  const baseKey = `${current.project}\u241F${current.file}`

  return (
    <div className="board">
      <IntroCard doc={current} edits={edits} baseKey={baseKey} writeSection={writeSection} />
      <SummaryCard doc={current} />
      {filtered.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          edits={edits}
          baseKey={baseKey}
          writeSection={writeSection}
        />
      ))}
      {filtered.length === 0 && (
        <EmptyState>
          {search
            ? t('empty.noSearch', { q: search })
            : t('empty.noStatus')}
        </EmptyState>
      )}
    </div>
  )
}

// ---------- CANVAS ----------

const STEP = 16

function snap(n: number, step = STEP): number {
  return Math.round(n / step) * step
}

export function CanvasView() {
  const {
    current,
    edits,
    writeSection,
    canvas,
    setCanvasLayout,
    removeCanvasLayout,
    resetCanvas,
    selected,
    setSelected,
    t,
  } = useApp()

  const viewportRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 60, y: 30, scale: 1 })
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)

  const baseKey = current ? `${current.project}\u241F${current.file}` : ''
  const sections = useMemo(
    () => (current ? current.sections.filter((s) => s.kind !== 'summary') : []),
    [current],
  )
  const positions = canvas[baseKey] ?? {}

  const resetView = useCallback(() => {
    setTransform({ x: 60, y: 30, scale: 1 })
  }, [])

  const fitView = useCallback(() => {
    if (!current) return
    const n = sections.length
    const maxX = n > 0 ? Math.max(...sections.map((_, i) => 80 + (i % 4) * 400 + 420)) : 900
    const maxY = n > 0 ? Math.max(...sections.map((_, i) => 80 + Math.floor(i / 4) * 320 + 300)) : 700
    const vp = viewportRef.current
    if (!vp) return
    const s = Math.max(0.35, Math.min(1, Math.min((vp.clientWidth - 90) / maxX, (vp.clientHeight - 90) / maxY)))
    const cx = (vp.clientWidth - maxX * s) / 2
    const cy = (vp.clientHeight - maxY * s) / 2
    setTransform({ x: Math.max(16, cx), y: Math.max(16, cy), scale: s })
  }, [current, sections])

  useEffect(() => {
    setSelected(null)
    // fit al cambiar de doc (una vez)
    const t = window.setTimeout(fitView, 60)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.project, current?.file])

  // zoom con la rueda
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      setTransform((t) => {
        const scale = Math.max(0.25, Math.min(2.2, t.scale * factor))
        const k = scale / t.scale
        return { scale, x: px - (px - t.x) * k, y: py - (py - t.y) * k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // pan del fondo
  const panRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)

  const onViewportPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-card')) return
    panRef.current = { startX: e.clientX, startY: e.clientY, ox: transform.x, oy: transform.y }
    const vp = e.currentTarget as HTMLElement
    vp.setPointerCapture(e.pointerId)
    setSelected(null)
  }
  const onViewportPointerMove = (e: React.PointerEvent) => {
    const pan = panRef.current
    if (!pan) return
    setTransform((t) => ({
      ...t,
      x: pan.ox + (e.clientX - pan.startX),
      y: pan.oy + (e.clientY - pan.startY),
    }))
  }
  const onViewportPointerUp = () => {
    panRef.current = null
  }

  const cardPos = (id: string, idx: number): CanvasLayout => positions[id] ?? newSectionDefaults(idx)

  const onCardPointerDown = (e: React.PointerEvent, id: string, idx: number) => {
    e.stopPropagation()
    const start = cardPos(id, idx)
    setSelected(id)
    const downX = e.clientX
    const downY = e.clientY
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - downX) / transform.scale
      const dy = (ev.clientY - downY) / transform.scale
      setDrag({ id, x: snap(start.x + dx), y: snap(start.y + dy) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDrag((d) => {
        if (d && d.id === id) setCanvasLayout(baseKey, id, { ...start, x: d.x, y: d.y })
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (!current) return <EmptyState>{t('empty.canvas')}</EmptyState>

  return (
    <div className="canvas-wrap">
      <div
        className="canvas-viewport"
        ref={viewportRef}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
      >
        <div
          className="canvas-world"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {sections.map((section, idx) => {
            const dragging = drag !== null && drag.id === section.id
            const pos = dragging ? { x: drag.x, y: drag.y, w: positions[section.id]?.w ?? 380 } : cardPos(section.id, idx)
            const isSelected = selected === section.id
            return (
              <div
                key={section.id}
                className={`canvas-card${isSelected ? ' selected' : ''}`}
                style={{ left: pos.x, top: pos.y, width: pos.w }}
                data-sid={section.id}
                onPointerDown={(e) => onCardPointerDown(e, section.id, idx)}
              >
                <header className="canvas-card-head">
                  <span className="canvas-index">{section.id.replace(/-.*$/, '')}</span>
                  <span className="canvas-title">{cleanHeading(section.heading ?? '')}</span>
                  {section.status && <span className={`chip chip-${section.status}`} />}
                </header>
                <div className="canvas-card-body">
                  <Markdown md={edits[`${baseKey}\u241E${section.id}`] ?? section.raw} />
                </div>
              </div>
            )
          })}
          <div className="canvas-note">{t('canvas.note')}</div>
        </div>
      </div>

      <div className="canvas-toolbar">
        <button className="btn ghost xs" onClick={fitView}>{t('canvas.fit')}</button>
        <button className="btn ghost xs" onClick={resetView}>{t('canvas.view')}</button>
        <button
          className="btn ghost xs"
          onClick={() => {
            resetCanvas(baseKey)
            toast(t('toast.canvasReset'))
          }}
        >
          {t('canvas.reset')}
        </button>
        <span className="zoom-label">{Math.round(transform.scale * 100)}%</span>
        <button className="btn ghost xs" onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.25, +(t.scale - 0.1).toFixed(2)) }))}>−</button>
        <button className="btn ghost xs" onClick={() => setTransform((t) => ({ ...t, scale: Math.min(2.2, +(t.scale + 0.1).toFixed(2)) }))}>＋</button>
      </div>

      {selected && (
        <Inspector
          sectionId={selected}
          doc={current}
          baseKey={baseKey}
          edits={edits}
          writeSection={writeSection}
          removeCanvasLayout={removeCanvasLayout}
        />
      )}
    </div>
  )
}

// ---------- INSPECTOR ----------

function Inspector({
  sectionId,
  doc,
  baseKey,
  edits,
  writeSection,
  removeCanvasLayout,
}: {
  sectionId: string
  doc: NonNullable<ReturnType<typeof useApp>['current']>
  baseKey: string
  edits: ReturnType<typeof useApp>['edits']
  writeSection: ReturnType<typeof useApp>['writeSection']
  removeCanvasLayout: ReturnType<typeof useApp>['removeCanvasLayout']
}) {
  const { setSelected, setCanvasLayout, t } = useApp()
  const section = doc.sections.find((s) => s.id === sectionId)
  const key = `${baseKey}\u241E${sectionId}`
  const raw = edits[key] ?? section?.raw ?? ''
  const [draft, setDraft] = useState(raw)
  const dirty = draft !== raw

  useEffect(() => {
    setDraft(raw)
  }, [raw])

  if (!section) return null

  const save = () => {
    writeSection(baseKey, sectionId, draft)
  }

  return (
    <aside className="inspector">
      <header className="inspector-head">
        <strong>{cleanHeading(section.heading ?? t('inspector.section'))}</strong>
        <button className="btn-icon" onClick={() => setSelected(null)} aria-label={t('inspector.close')}>✕</button>
      </header>
      <div className="inspector-meta">
        <span className="lno">{t('inspector.type', { type: section.kind })}</span>
        <span className="lno">L{section.startLine}–{section.endLine}</span>
        <span className="lno">status: {section.status ?? '—'}</span>
      </div>
      <label className="inspector-label">{t('inspector.markdown')}</label>
      <textarea
        className="inspector-textarea"
        spellCheck={false}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="inspector-preview">
        <span className="inspector-label">{t('inspector.preview')}</span>
        <Markdown key={dirty ? 'd' : 'r'} md={draft} />
      </div>
      <div className="inspector-actions">
        <button
          className="btn ghost xs"
          onClick={() => removeCanvasLayout(baseKey, sectionId)}
          title={t('canvas.position.title')}
        >
          {t('canvas.position')}
        </button>
        <button className="btn ghost xs" onClick={() => { void navigator.clipboard.writeText(raw); toast(t('toast.sectionCopied')) }}>
          {t('inspector.copy')}
        </button>
        <button className="btn ghost xs" onClick={() => { const { x, y, w } = positionsDefault(doc, sectionId); setCanvasLayout(baseKey, sectionId, { x, y, w, collapsed: false }); setDraft(raw) }} disabled={!dirty && false}>
          {t('inspector.restore')}
        </button>
        <button className="btn primary sm" onClick={save} disabled={!dirty}>
          {t('inspector.save')}
        </button>
      </div>
    </aside>
  )
}

function positionsDefault(doc: { file: string; sections: { id: string }[] }, sectionId: string) {
  const idx = doc.sections.findIndex((s) => s.id === sectionId)
  return newSectionDefaults(Math.max(0, idx))
}