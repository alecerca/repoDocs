import type { AdrRecord, AdrRelation, AdrRelationType, AdrStatusMeta, AdrStatus, AdrSection } from '../generated/adr'
import { ADRS } from '../generated/adr'
import { sectionKey, type EditsMap } from './registry'

export type { AdrRecord, AdrRelation, AdrRelationType, AdrStatusMeta, AdrStatus, AdrSection }

/** Marca del "intro" (front-matter + título) dentro del mapa de edits de un ADR. */
export const ADR_INTRO_MARK = '__adr__intro__'

/** Clave base (mismo formato `${project}\u241F${file}` que los docs). */
export function adrBaseKey(rec: { project: string; file: string }): string {
  return `${rec.project}\u241F${rec.file}`
}

export function adrSectionKey(base: string, sectionId: string): string {
  return sectionKey(base, sectionId)
}

/** Reconstruye el .md completo del ADR a partir de las ediciones (write-back pérdida cero). */
export function assembleAdr(rec: AdrRecord, edits: EditsMap, baseKey: string): string {
  const intro = edits[adrSectionKey(baseKey, ADR_INTRO_MARK)] ?? rec.intro
  const repls: { s: number; e: number; text: string }[] = [{ s: 0, e: rec.introEndLine + 1, text: intro }]
  for (const section of rec.sections) {
    repls.push({
      s: section.startLine - 1,
      e: section.endLine,
      text: edits[adrSectionKey(baseKey, section.id)] ?? section.raw,
    })
  }
  repls.sort((a, b) => b.s - a.s)
  const lines = rec.raw.split('\n')
  for (const r of repls) {
    lines.splice(r.s, Math.max(0, r.e - r.s), ...r.text.split('\n'))
  }
  let out = lines.join('\n').trimEnd()
  return out ? `${out}\n` : out
}

/** Todos los ADRs (ya ordenados por proyecto y archivo). */
export const ADRS_ALL: AdrRecord[] = ADRS

export function adrsByProject(): Record<string, AdrRecord[]> {
  const map: Record<string, AdrRecord[]> = {}
  for (const a of ADRS) {
    map[a.project] ??= []
    map[a.project].push(a)
  }
  return map
}

export function adrStatus(rec: AdrRecord): AdrStatusMeta {
  return (
    rec.statusMeta.find((s) => s.key === rec.status) ?? {
      key: rec.status,
      emoji: '•',
      label: rec.status,
      plural: rec.status,
    }
  )
}

// ---------- Grafo ----------

export interface GraphEdge {
  from: string
  to: string
  kind: AdrRelationType
}

export function buildGraph(records: AdrRecord[]): { nodes: AdrRecord[]; edges: GraphEdge[] } {
  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  for (const r of records) {
    for (const rel of r.relations) {
      const key = `${r.id}\u2192${rel.targetId}:${rel.type}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ from: r.id, to: rel.targetId, kind: rel.type })
    }
  }
  return { nodes: records, edges }
}

/** "0007 → fue reemplazada por". Clave por id de ADR. */
export function supersededByMap(records: AdrRecord[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const r of records) {
    for (const rel of r.relations) {
      if (rel.type !== 'supersedes') continue
      map[rel.targetId] ??= []
      map[rel.targetId].push(r.id)
    }
  }
  return map
}

/** Layout por capas: columna = profundidad de superseding, fila = fecha. */
export function layeredLayout(records: AdrRecord[], edges: GraphEdge[]): Record<string, { x: number; y: number }> {
  const ids = new Set(records.map((r) => r.id))
  const byId = new Map(records.map((r) => [r.id, r]))
  const rank: Record<string, number> = {}
  for (const r of records) rank[r.id] = 0

  const visit = (id: string, depth: number): number => {
    if ((rank[id] ?? 0) >= depth) return rank[id] ?? 0
    rank[id] = depth
    for (const e of edges) {
      if (e.from !== id && e.to !== id) continue
      if (e.kind !== 'supersedes' && e.kind !== 'depends_on') continue
      const nextId = e.from === id ? e.to : e.from
      if (!ids.has(nextId)) continue
      const edgeFrom = e.from === id
      visit(nextId, depth + (edgeFrom ? 1 : -1))
    }
    return rank[id] ?? 0
  }
  for (const r of records) visit(r.id, rank[r.id])

  const columns: Record<number, string[]> = {}
  for (const r of records) {
    const c = rank[r.id] ?? 0
    ;(columns[c] ??= []).push(r.id)
  }
  const order = [...new Set(records.map((r) => rank[r.id] ?? 0))].sort((a, b) => a - b)

  const out: Record<string, { x: number; y: number }> = {}
  for (const c of order) {
    const list = (columns[c] ?? []).slice().sort((a, b) => {
      const da = byId.get(a)?.date ?? ''
      const db = byId.get(b)?.date ?? ''
      return da.localeCompare(db)
    })
    list.forEach((id, i) => {
      out[id] = { x: 60 + order.indexOf(c) * 340, y: 40 + i * 220 }
    })
  }
  return out
}