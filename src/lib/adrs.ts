import type { AdrRecord, AdrRelation, AdrRelationType, AdrStatusMeta, AdrStatus, AdrSection } from '../generated/adr'
import { ADRS } from '../generated/adr'
import { sectionKey, type EditsMap } from './registry'
import { buildGraph, supersededByMap, layeredLayout, toMermaid, cleanMermaidLabel, type GraphEdge } from './adrGraph'

export type { AdrRecord, AdrRelation, AdrRelationType, AdrStatusMeta, AdrStatus, AdrSection }
export { buildGraph, supersededByMap, layeredLayout, toMermaid, cleanMermaidLabel, type GraphEdge }

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