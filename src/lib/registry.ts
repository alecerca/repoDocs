import type { Doc } from '../generated/docs'
import { DOCS } from '../generated/docs'

export type { Doc, DocSection, DocStatus, DocSummaryEntry } from '../generated/docs'

export type ProjectDocs = {
  project: string
  docs: Doc[]
}

export function groupByProject(): ProjectDocs[] {
  const map = new Map<string, Doc[]>()
  for (const doc of DOCS) {
    if (!map.has(doc.project)) map.set(doc.project, [])
    map.get(doc.project)!.push(doc)
  }
  return [...map.entries()].map(([project, docs]) => ({ project, docs }))
}

export const PROJECTS = groupByProject()

export function docKey(project: string, file: string): string {
  return `${project}\u241F${file}`
}

export function sectionKey(base: string, sectionId: string): string {
  return `${base}\u241E${sectionId}`
}

export const INTRO_MARK = '\u241E__intro__'

export type EditsMap = Record<string, string>

export type CanvasLayout = { x: number; y: number; w: number; collapsed: boolean }

export type CanvasMap = Record<string, Record<string, CanvasLayout>>

/** Orden del doc: header docs primero, recomendaciones después. */
export const DOC_ORDER_PRIORITY = (file: string): number => {
  const f = file.toLowerCase()
  if (f.includes('agents')) return 0
  if (f.includes('recomend')) return 1
  if (f.includes('readme')) return 2
  return 3
}

export function typeDocFile(file: string): string {
  const f = file.toLowerCase()
  if (f.includes('agents')) return 'agents'
  if (f.includes('recomend')) return 'recomend'
  if (f.includes('readme')) return 'readme'
  if (f.includes('claude')) return 'claude'
  return 'md'
}

export const DOC_TYPE_ICON: Record<string, string> = {
  agents: '📋',
  recomend: '🎯',
  readme: '📖',
  claude: '🧠',
  md: '📄',
}

/**
 * Reconstruye el markdown completo del doc a partir de las ediciones.
 * Reemplaza por rango de líneas para preservar separadores y orden.
 */
export function assembleRaw(doc: Doc, edits: EditsMap, baseKey: string): string {
  const intro = edits[sectionKey(baseKey, INTRO_MARK)] ?? doc.intro
  const repls: { s: number; e: number; text: string }[] = [
    { s: 0, e: doc.introEndLine + 1, text: intro },
  ]
  for (const section of doc.sections) {
    let text = edits[sectionKey(baseKey, section.id)] ?? section.raw
    if (section.kind === 'summary' && !edits[sectionKey(baseKey, section.id)] && doc.summary) {
      text = rebuildSummaryText(section, doc)
    }
    repls.push({ s: section.startLine - 1, e: section.endLine, text })
  }
  repls.sort((a, b) => b.s - a.s)
  const lines = doc.raw.split('\n')
  for (const r of repls) {
    lines.splice(r.s, Math.max(0, r.e - r.s), ...r.text.split('\n'))
  }
  let out = lines.join('\n').trimEnd()
  return out ? `${out}\n` : out
}

function rebuildSummaryText(section: { heading: string | null }, doc: Doc): string {
  const rows = doc.summary!.entries
    .filter((e) => e.num !== '#')
    .map((e) => `| ${e.num} | ${e.tema} | ${e.estado} |`)
    .join('\n')
  const heading = section.heading ? `${section.heading}\n` : ''
  return `${heading}\n| # | Tema | Estado |\n| --- | --- | --- |\n${rows}`
}