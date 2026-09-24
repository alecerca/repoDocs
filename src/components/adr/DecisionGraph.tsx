import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { AdrRecord } from '../../lib/adrs'
import { buildGraph, layeredLayout, supersededByMap, type GraphEdge } from '../../lib/adrs'
import { adrStatus } from '../../lib/adrs'
import { cleanHeading } from '../Cards'
import { useApp } from '../../state/AppContext'

const STEP = 16
const NODE_W = 240
const NODE_H = 54

function snap(n: number): number {
  return Math.round(n / STEP) * STEP
}

export function DecisionGraph({ adrs, project }: { adrs: AdrRecord[]; project: string }) {
  const { t } = useApp()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 40, y: 30, scale: 1 })
  const [selected, setSelected] = useState<string | null>(null)
  const [moves, setMoves] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`pb:adrGraph:${project}`) ?? '{}')
    } catch {
      return {}
    }
  })

  const { nodes, edges } = useMemo(() => buildGraph(adrs), [adrs])
  const defaults = useMemo(() => layeredLayout(adrs, edges), [adrs, edges])
  const supMap = useMemo(() => supersededByMap(adrs), [adrs])
  const posOf = useCallback(
    (id: string) => moves[id] ?? defaults[id] ?? { x: 60, y: 60 },
    [moves, defaults]
  )

  const persist = (next: Record<string, { x: number; y: number }>) => {
    setMoves(next)
    try {
      localStorage.setItem(`pb:adrGraph:${project}`, JSON.stringify(next))
    } catch {
      /* noop */
    }
  }

  // pan del fondo
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.adr-node')) return
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: transform.x, oy: transform.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setSelected(null)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const pan = panRef.current
    if (!pan) return
    setTransform((tm) => ({ ...tm, x: pan.ox + (e.clientX - pan.sx), y: pan.oy + (e.clientY - pan.sy) }))
  }
  const onPointerUp = () => {
    panRef.current = null
  }

  // zoom con la rueda
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setTransform((tm) => {
        const scale = Math.max(0.3, Math.min(1.8, tm.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
        const k = scale / tm.scale
        return { scale, x: px - (px - tm.x) * k, y: py - (py - tm.y) * k }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const fitView = useCallback(() => {
    const n = nodes.length
    const cols = Math.min(4, n) || 1
    const rows = Math.ceil(n / cols) || 1
    const maxX = 120 + cols * (NODE_W + 120)
    const maxY = 80 + rows * (NODE_H + 120)
    const vp = viewportRef.current
    if (!vp) return
    const s = Math.max(0.3, Math.min(1, Math.min((vp.clientWidth - 80) / maxX, (vp.clientHeight - 80) / maxY)))
    setTransform({ x: Math.max(12, (vp.clientWidth - maxX * s) / 2), y: Math.max(12, (vp.clientHeight - maxY * s) / 2), scale: s })
  }, [nodes])

  useEffect(() => {
    const tm = window.setTimeout(fitView, 60)
    return () => window.clearTimeout(tm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  const onNodeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    setSelected(id)
    const start = posOf(id)
    const sx = e.clientX
    const sy = e.clientY
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / transform.scale
      const dy = (ev.clientY - sy) / transform.scale
      persist({ ...moves, [id]: { x: snap(start.x + dx), y: snap(start.y + dy) } })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const edgeColor = (kind: GraphEdge['kind']): string => {
    if (kind === 'supersedes' || kind === 'superseded_by') return '#e05c5c'
    if (kind === 'depends_on') return '#5c9be0'
    return '#8a8a93'
  }

  const nodeById = (id: string): AdrRecord | undefined => nodes.find((n) => n.id === id)

  return (
    <div className="adr-graph-wrap">
      <div className="canvas-viewport adr-graph" ref={viewportRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="canvas-world" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0' }}>
          <svg className="adr-graph-svg" width={2400} height={1600}>
            {edges.map((e, i) => {
              if (!nodeById(e.from) || !nodeById(e.to)) return null
              const a = posOf(e.from)
              const b = posOf(e.to)
              const x1 = a.x + NODE_W
              const y1 = a.y + NODE_H / 2
              const x2 = b.x - 8
              const y2 = b.y + NODE_H / 2
              const dim = selected !== null && selected !== e.from && selected !== e.to
              return (
                <g key={i} className={`adr-edge${dim ? ' dim' : ''}`}>
                  <path d={`M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`} fill="none" stroke={edgeColor(e.kind)} strokeWidth={2} strokeDasharray={e.kind === 'related_to' ? '4 3' : undefined} />
                  <circle cx={x2} cy={y2} r={4} fill={edgeColor(e.kind)} />
                </g>
              )
            })}
          </svg>
          {nodes.map((n) => {
            const pos = posOf(n.id)
            const status = adrStatus(n)
            const isSel = selected === n.id
            const dim = selected !== null && !isSel && !edges.some((e) => (e.from === n.id || e.to === n.id) && (e.from === selected || e.to === selected))
            return (
              <div
                key={n.id}
                className={`adr-node${isSel ? ' selected' : ''}${dim ? ' dim' : ''}`}
                style={{ left: pos.x, top: pos.y, width: NODE_W }}
                data-id={n.id}
                onPointerDown={(e) => onNodeDown(e, n.id)}
              >
                <span className="adr-node-idx">{n.id}</span>
                <span className="adr-node-title">{cleanHeading(n.title)}</span>
                <span className={`chip chip-adr-${n.status}`}>{status.emoji} {status.label}</span>
                {(supMap[n.id] ?? []).length > 0 && supMap[n.id]!.some((s) => nodeById(s)) && (
                  <span className="adr-badge adr-badge-alert">{t('adr.replacedBy')} {supMap[n.id].join(', ')}</span>
                )}
              </div>
            )
          })}
          <div className="adr-graph-note">{t('adr.graph.note')}</div>
        </div>
      </div>
      <div className="canvas-toolbar adr-toolbar">
        <button className="btn ghost xs" onClick={fitView}>{t('canvas.fit')}</button>
        <button className="btn ghost xs" onClick={() => setTransform({ x: 40, y: 30, scale: 1 })}>{t('canvas.view')}</button>
        <span className="zoom-label">{Math.round(transform.scale * 100)}%</span>
        <button className="btn ghost xs" onClick={() => setTransform((tm) => ({ ...tm, scale: Math.max(0.3, +(tm.scale - 0.1).toFixed(2)) }))}>−</button>
        <button className="btn ghost xs" onClick={() => setTransform((tm) => ({ ...tm, scale: Math.min(1.8, +(tm.scale + 0.1).toFixed(2)) }))}>＋</button>
      </div>
    </div>
  )
}