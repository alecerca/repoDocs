import type { Doc } from '../generated/docs'
import { DOCS } from '../generated/docs'
import { SUMMARY } from './config'

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
  const [cNum, cTopic, cStatus] = SUMMARY.headers
  const heading = section.heading ? `${section.heading}\n` : ''
  return `${heading}\n| ${cNum} | ${cTopic} | ${cStatus} |\n| --- | --- | --- |\n${rows}`
}

/**
 * Parses raw markdown content into a structured Doc representation.
 *
 * @param project Project identifier
 * @param file Relative file path inside the project
 * @param raw Complete markdown source code
 * @returns Structured Doc object
 */
export function parseMarkdownDoc(project: string, file: string, raw: string): Doc {
  const lines = raw.split('\n')
  let title = file
  let subtitle = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('# ') && title === file) {
      title = line.replace(/^#\s+/, '').trim()
    } else if (line.startsWith('>') && !subtitle) {
      subtitle = line.replace(/^>\s*/, '').trim()
    }
  }

  let firstH2 = -1
  const sections: Doc['sections'] = []
  let current: { heading: string; start: number; level: number } | null = null

  const flush = (heading: string, start: number, end: number, level: number) => {
    const rawChunk = lines.slice(start, end + 1).join('\n')
    const id = `${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sec'}-${sections.length}`
    let status: Doc['sections'][0]['status'] = null
    const lower = rawChunk.toLowerCase()
    if (lower.includes('✅') || lower.includes('done') || lower.includes('hecho')) {
      status = 'done'
    } else if (lower.includes('📌') || lower.includes('pending') || lower.includes('pendiente')) {
      status = 'pending'
    } else if (lower.includes('🔶') || lower.includes('progress') || lower.includes('progreso')) {
      status = 'progress'
    }
    sections.push({
      id,
      heading,
      level,
      kind: 'section',
      raw: rawChunk,
      startLine: start + 1,
      endLine: end + 1,
      status,
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^##\s+/.test(line)) {
      if (firstH2 === -1) firstH2 = i
      if (current) flush(current.heading, current.start, i - 1, current.level)
      current = { heading: line.replace(/^##\s+/, '').trim(), start: i, level: 2 }
    }
  }
  if (current) flush(current.heading, current.start, lines.length - 1, current.level)

  if (sections.length === 0 && raw.trim()) {
    let fallbackStatus: Doc['sections'][0]['status'] = null
    const lowerRaw = raw.toLowerCase()
    if (lowerRaw.includes('✅') || lowerRaw.includes('done') || lowerRaw.includes('hecho')) {
      fallbackStatus = 'done'
    } else if (lowerRaw.includes('📌') || lowerRaw.includes('pending') || lowerRaw.includes('pendiente')) {
      fallbackStatus = 'pending'
    } else if (lowerRaw.includes('🔶') || lowerRaw.includes('progress') || lowerRaw.includes('progreso')) {
      fallbackStatus = 'progress'
    }
    sections.push({
      id: 'section-0',
      heading: title,
      level: 1,
      kind: 'section',
      raw: raw.trim(),
      startLine: 1,
      endLine: lines.length,
      status: fallbackStatus,
    })
  }

  const introEnd = firstH2 === -1 ? lines.length - 1 : firstH2 - 1
  const intro = lines.slice(0, firstH2 === -1 ? lines.length : firstH2).join('\n').trim()

  const statusCounts: Doc['statusCounts'] = { done: 0, pending: 0, progress: 0 }
  for (const s of sections) {
    if (s.status) statusCounts[s.status]++
  }

  let hashVal = 0x811c9dc5
  for (let i = 0; i < raw.length; i++) {
    hashVal ^= raw.charCodeAt(i)
    hashVal = Math.imul(hashVal, 0x01000193)
  }

  return {
    file,
    path: `${project}/${file}`,
    project,
    title,
    subtitle,
    raw,
    intro,
    introEndLine: Math.max(0, introEnd),
    sections,
    summary: null,
    statusCounts,
    sha: (hashVal >>> 0).toString(16),
    lines: lines.length,
    bytes: raw.length,
  }
}