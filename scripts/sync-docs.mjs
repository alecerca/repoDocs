#!/usr/bin/env node
/**
 * sync-docs.mjs
 *
 * Escanea los proyectos indicados en mdboard.json (+ mdboard.local.json), lee
 * los *.md de la raíz de cada proyecto (AGENTS.md, recomendaciones.md, README.md,
 * CLAUDE.md, etc.) y genera:
 *   - src/generated/docs.ts   → estructura de docs/secciones
 *   - src/generated/appconfig.ts → status, brands y apps (para el front-end)
 *
 * Lo corre el propio npm dev/build (predev/prebuild). También se puede ejecutar
 * a mano con `npm run sync` para refrescar tras tocar un .md.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { join, basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.mjs'

const cfg = loadConfig()
const PROYECTOS_DIR = cfg.projectsAbs
const OUT_DIR = cfg.outputAbs
const OUT_FILE = join(OUT_DIR, 'docs.ts')
const APPCONFIG_FILE = join(OUT_DIR, 'appconfig.ts')

const SELF = 'proyectos-board'
const SKIP = new Set([SELF, 'node_modules', '.git', '.expo', 'dist', '.vscode', '.claude', '.idea', 'android', 'ios'])

export function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildStatusPatterns(statusList) {
  return statusList.map((s) => {
    const hintPart = s.hint ? `|${s.hint}` : ''
    return {
      key: s.key,
      label: s.label,
      emoji: s.emoji,
      plural: s.plural,
      re: new RegExp(`${escapeRe(s.emoji)}${hintPart}`, 'i'),
    }
  })
}

export const STATUS_PATTERNS = buildStatusPatterns(cfg.status)

export function detectStatus(text, patterns = STATUS_PATTERNS) {
  const counts = {}
  for (const s of patterns) counts[s.key] = 0
  for (const s of patterns) {
    const matches = text.match(s.re)
    if (matches) counts[s.key] = matches.length
  }
  const order = patterns.map((s) => s.key)
  return order
    .filter((k) => (counts[k] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .map((k) => ({ key: k }))
}

export function applyStatusOverrides(baseStatusList, overrides) {
  if (!overrides) return baseStatusList
  const result = baseStatusList.map((s) => ({ ...s }))

  if (Array.isArray(overrides)) {
    for (const item of overrides) {
      if (!item || typeof item !== 'object' || !item.key) continue
      const idx = result.findIndex((s) => s.key === item.key)
      if (idx >= 0) {
        result[idx] = {
          ...result[idx],
          ...item,
          emoji: item.emoji ?? result[idx].emoji,
          label: item.label ?? result[idx].label,
          plural: item.plural ?? result[idx].plural,
          hint: item.hint ?? result[idx].hint,
        }
      } else {
        result.push({
          key: item.key,
          emoji: item.emoji ?? '•',
          label: item.label ?? item.key,
          plural: item.plural ?? item.label ?? item.key,
          hint: item.hint,
        })
      }
    }
  } else if (typeof overrides === 'object' && overrides !== null) {
    for (const [key, val] of Object.entries(overrides)) {
      const idx = result.findIndex((s) => s.key === key)
      if (typeof val === 'string') {
        if (idx >= 0) {
          result[idx] = { ...result[idx], emoji: val }
        } else {
          result.push({
            key,
            emoji: val,
            label: key,
            plural: key,
          })
        }
      } else if (typeof val === 'object' && val !== null) {
        if (idx >= 0) {
          result[idx] = {
            ...result[idx],
            ...val,
            emoji: val.emoji ?? result[idx].emoji,
            label: val.label ?? result[idx].label,
            plural: val.plural ?? result[idx].plural,
            hint: val.hint ?? result[idx].hint,
          }
        } else {
          result.push({
            key,
            emoji: val.emoji ?? '•',
            label: val.label ?? key,
            plural: val.plural ?? val.label ?? key,
            hint: val.hint,
          })
        }
      }
    }
  }

  return result
}

export function parseYamlStatus(yamlText) {
  try {
    const json = JSON.parse(yamlText)
    if (json && json.status) return json.status
  } catch {
    // not JSON
  }

  const lines = yamlText.split('\n')
  let statusLines = []
  let capturing = false
  let baseIndent = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!capturing) {
      const match = line.match(/^status:\s*(.*)$/)
      if (match) {
        const afterColon = match[1].trim()
        if (afterColon) {
          try {
            return JSON.parse(afterColon)
          } catch {
            return afterColon
          }
        }
        capturing = true
      }
    } else {
      if (line.trim() === '') continue
      const matchIndent = line.match(/^(\s+)(.*)$/)
      if (!matchIndent) break
      const indent = matchIndent[1].length
      if (baseIndent === -1) baseIndent = indent
      if (indent < baseIndent) break
      statusLines.push(line)
    }
  }

  if (statusLines.length === 0) return null

  const isList = statusLines.some((l) => /^\s*-\s+/.test(l))
  if (isList) {
    const items = []
    let currentItem = null
    for (const l of statusLines) {
      const itemMatch = l.match(/^\s*-\s*(.*)$/)
      if (itemMatch) {
        if (currentItem) items.push(currentItem)
        currentItem = {}
        const rest = itemMatch[1].trim()
        if (rest.includes(':')) {
          const colonIdx = rest.indexOf(':')
          const k = rest.slice(0, colonIdx).trim()
          const v = rest.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '')
          currentItem[k] = v
        }
      } else if (currentItem) {
        const propMatch = l.match(/^\s*([a-zA-Z0-9_-]+):\s*(.*)$/)
        if (propMatch) {
          currentItem[propMatch[1].trim()] = propMatch[2].trim().replace(/^['"]|['"]$/g, '')
        }
      }
    }
    if (currentItem) items.push(currentItem)
    return items
  } else {
    const map = {}
    let currentKey = null
    for (const l of statusLines) {
      const nested = l.match(/^\s{4,}([a-zA-Z0-9_-]+):\s*(.*)$/)
      const kv = l.match(/^\s{1,3}([a-zA-Z0-9_-]+):\s*(.*)$/)
      if (nested && currentKey && typeof map[currentKey] === 'object') {
        map[currentKey][nested[1].trim()] = nested[2].trim().replace(/^['"]|['"]$/g, '')
      } else if (kv) {
        const k = kv[1].trim()
        const v = kv[2].trim().replace(/^['"]|['"]$/g, '')
        if (!v) {
          map[k] = {}
          currentKey = k
        } else {
          map[k] = v
          currentKey = null
        }
      }
    }
    return map
  }
}

export function extractFrontmatter(raw) {
  if (!raw.startsWith('---')) return { frontmatter: null, content: raw }
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return { frontmatter: null, content: raw }
  const yamlText = match[1]
  const parsed = parseYamlStatus(yamlText)
  return { frontmatter: parsed, content: raw }
}

export function resolveDocStatus(globalStatus, brand, docFile, rawContent) {
  let list = globalStatus.map((s) => ({ ...s }))

  // 1. Project-level status override
  if (brand?.status) {
    list = applyStatusOverrides(list, brand.status)
  }

  // 2. Doc-level status override in project brand config
  if (brand) {
    const nameWithoutExt = basename(docFile, extname(docFile))
    const docConfig = brand.docs?.[docFile] ?? brand.docs?.[nameWithoutExt]
    const docStatus = docConfig?.status ?? brand.statusByDoc?.[docFile] ?? brand.statusByDoc?.[nameWithoutExt]
    if (docStatus) {
      list = applyStatusOverrides(list, docStatus)
    }
  }

  // 3. Frontmatter status override in markdown doc
  if (rawContent) {
    const { frontmatter } = extractFrontmatter(rawContent)
    if (frontmatter) {
      list = applyStatusOverrides(list, frontmatter)
    }
  }

  return list
}

export function isStatusCustomized(globalStatus, docStatus) {
  if (globalStatus.length !== docStatus.length) return true
  for (let i = 0; i < globalStatus.length; i++) {
    const g = globalStatus[i]
    const d = docStatus[i]
    if (
      g.key !== d.key ||
      g.emoji !== d.emoji ||
      g.label !== d.label ||
      g.plural !== d.plural ||
      g.hint !== d.hint
    ) {
      return true
    }
  }
  return false
}

function slugify(str, idx) {
  const base = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'y')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'seccion'}-${idx}`
}

function normalizeCell(cell) {
  return cell.toLowerCase().replace(/[*`]/g, '').trim()
}

function parseTable(lines, startLine, endLine) {
  const rows = []
  for (let i = startLine; i <= endLine; i++) {
    const line = lines[i]
    const body = line.trim().replace(/^\||\|$/g, '')
    if (!body || /^\s*[-:|\s]+\s*$/.test(body)) continue
    const cells = body.split('|').map((c) => c.trim())
    if (cells.length && cells[0] !== '') rows.push(cells)
  }
  return rows
}

/**
 * Busca la "summary table" del doc: primera tabla cuyo header sea
 * #/num, tema y estado. Devuelve {startLine, endLine, entries}.
 */
function findSummaryTable(lines) {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed.startsWith('|')) continue
    const headerCells = trimmed
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(normalizeCell)
    const hasNum = headerCells.some((c) => /^#?$/i.test(c) || /num/.test(c) || /^\s*$/.test(c))
    const hasTema = headerCells.some((c) => /tema|topic/.test(c))
    const hasEstado = headerCells.some((c) => /estado|status/.test(c))
    if (!(hasTema && hasEstado)) continue
    let end = i
    while (end + 1 < lines.length && lines[end + 1].trim().startsWith('|')) end++
    const rows = parseTable(lines, i, end)
    const entries = []
    for (const cells of rows) {
      if (cells.length < 3) continue
      const num = cells.find((c, idx) => idx === 0 || c.match(/^\d+\s*-*\s*\d*$/)) || cells[0]
      const temaIdx = Math.max(hasNum ? 1 : 0, 0)
      const estado = cells.slice(-1)[0]
      entries.push({ num: String(num).trim(), tema: cells[Math.min(temaIdx, cells.length - 2)] || '', estado })
    }
    if (entries.length) return { startLine: i, endLine: end, entries }
  }
  return null
}

export function parseDoc(filePath, projectName, brand = null) {
  const raw = readFileSync(filePath, 'utf8')
  const lines = raw.split('\n')
  const docFile = basename(filePath)
  const docStatusList = resolveDocStatus(cfg.status, brand, docFile, raw)
  const docStatusPatterns = buildStatusPatterns(docStatusList)
  const isCustom = isStatusCustomized(cfg.status, docStatusList)

  const titleMatch = raw.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : basename(filePath, extname(filePath))

  const subMatch = raw.match(/^#\s+.+\n+(>.*(?:\n>.*)*)/)
  const subtitle = subMatch ? subMatch[1].trim().replace(/^>\s?/gm, '') : ''

  const summary = findSummaryTable(lines)

  const sections = []
  let current = null
  let firstH2 = -1

  const flush = (heading, start, end, headingLevel) => {
    const rawBlock = lines.slice(start, end + 1).join('\n')
    if (!rawBlock.trim()) return
    const statuses = detectStatus(rawBlock, docStatusPatterns).map((s) => s.key)
    sections.push({
      id: slugify(heading || rawBlock.slice(0, 60), sections.length),
      heading: heading ? heading.trim() : null,
      level: headingLevel,
      kind: heading ? 'section' : 'chunk',
      raw: rawBlock,
      startLine: start + 1,
      endLine: end + 1,
      status: statuses.length ? statuses[0] : null,
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^#{2}\s/.test(line)) {
      if (firstH2 === -1) {
        firstH2 = i
      }
      if (current) flush(current.heading, current.start, i - 1, current.level)
      current = { heading: line.replace(/^#{2}\s+/, ''), start: i, level: 2 }
    }
  }
  if (current) flush(current.heading, current.start, lines.length - 1, current.level)

  let introRaw = lines.slice(0, firstH2 === -1 ? lines.length : firstH2).join('\n').replace(/^\n+/, '')

  if (summary) {
    const summaryRaw = lines.slice(summary.startLine, summary.endLine + 1).join('\n')
    introRaw = introRaw.replace(summaryRaw, '').replace(/\n{3,}/g, '\n\n').trim()
  }

  if (summary) {
    const summaryRaw = lines.slice(summary.startLine, summary.endLine + 1).join('\n')
    for (const s of sections) {
      if (s.raw.includes(summaryRaw)) {
        s.kind = 'summary'
        s.raw = s.raw.replace(summaryRaw, '').replace(/\n{3,}/g, '\n\n').trim()
        if (!s.heading) s.heading = cfg.summary.heading
      }
    }
  }

  const statusCounts = {}
  for (const s of docStatusList) statusCounts[s.key] = 0
  for (const s of sections) {
    if (s.status) statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1
  }

  const docObj = {
    file: docFile,
    path: filePath,
    project: projectName,
    title,
    subtitle,
    raw,
    intro: introRaw,
    introEndLine: firstH2 === -1 ? lines.length - 1 : firstH2 - 1,
    sections,
    summary: summary ? { entries: summary.entries } : null,
    statusCounts,
    sha: hash(raw),
    lines: lines.length,
    bytes: raw.length,
  }

  if (isCustom) {
    docObj.statusMeta = docStatusList.map((s) => ({
      key: s.key,
      emoji: s.emoji,
      label: s.label,
      plural: s.plural,
    }))
  }

  return docObj
}

function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export function collect() {
  const projects = readdirSync(PROYECTOS_DIR)
    .filter((name) => {
      if (SKIP.has(name) || name.startsWith('.')) return false
      const p = join(PROYECTOS_DIR, name)
      return statSync(p).isDirectory()
    })
    .map((name) => {
      const dir = join(PROYECTOS_DIR, name)
      let mds = []
      try {
        mds = readdirSync(dir).filter((f) => extname(f).toLowerCase() === '.md')
      } catch {
        mds = []
      }
      return { name, dir, mds }
    })
    .filter((p) => p.mds.length > 0)

  const docs = []
  for (const p of projects) {
    const brand = cfg.brands?.[p.name] ?? null
    for (const md of p.mds) {
      docs.push(parseDoc(join(p.dir, md), p.name, brand))
    }
  }
  docs.sort((a, b) => a.project.localeCompare(b.project) || a.file.localeCompare(b.file))
  return { projects: projects.length, docs }
}

export function writeDocs(docs, projectsCount) {
  const generatedAt = new Date().toISOString()
  const code =
    `// AUTO-GENERADO por scripts/sync-docs.mjs — NO editar a mano.\n` +
    `// Fuente: *.md de cada proyecto en ${JSON.stringify(PROYECTOS_DIR)}\n` +
    `// Generado: ${generatedAt}\n\n` +
    `export interface DocSummaryEntry {\n  num: string\n  tema: string\n  estado: string\n}\n\n` +
    `export type DocStatus = 'done' | 'pending' | 'progress' | (string & {})\n\n` +
    `export interface DocStatusMeta {\n  key: string\n  emoji: string\n  label: string\n  plural: string\n}\n\n` +
    `export interface DocSection {\n  id: string\n  heading: string | null\n  level: number\n  kind: 'section' | 'chunk' | 'summary'\n  raw: string\n  startLine: number\n  endLine: number\n  status: DocStatus | null\n}\n\n` +
    `export interface Doc {\n  file: string\n  path: string\n  project: string\n  title: string\n  subtitle: string\n  raw: string\n  intro: string\n  introEndLine: number\n  sections: DocSection[]\n  summary: { entries: DocSummaryEntry[] } | null\n  statusCounts: Record<string, number>\n  statusMeta?: DocStatusMeta[]\n  sha: string\n  lines: number\n  bytes: number\n}\n\n` +
    `export const DOCS: Doc[] = ${JSON.stringify(docs, null, 2)}\n`
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, code, 'utf8')
  const totalSections = docs.reduce((acc, d) => acc + d.sections.length, 0)
  console.log(`[sync-docs] ${docs.length} docs en ${projectsCount} proyectos (${totalSections} secciones) → ${OUT_FILE}`)
}

export function writeAppConfig() {
  const generatedAt = new Date().toISOString()
  const statusMeta = cfg.status.map((s) => ({
    key: s.key,
    emoji: s.emoji,
    label: s.label,
    plural: s.plural,
  }))
  const code =
    `// AUTO-GENERADO por scripts/sync-docs.mjs — NO editar a mano.\n` +
    `// Generado: ${generatedAt}\n\n` +
    `export interface StatusMeta {\n  key: string\n  emoji: string\n  label: string\n  plural: string\n}\n` +
    `export const STATUS_META: StatusMeta[] = ${JSON.stringify(statusMeta, null, 2)}\n\n` +
    `export interface Brand {\n  name: string\n  tagline: string\n  accent: string\n  accent2: string\n  darkBg: string\n  surface: string\n  surfaceAlt: string\n  text: string\n  muted: string\n  palette: string[]\n  stack: string[]\n  status?: StatusMeta[] | Record<string, string | Partial<StatusMeta>>\n  docs?: Record<string, { status?: StatusMeta[] | Record<string, string | Partial<StatusMeta>> }>\n  statusByDoc?: Record<string, StatusMeta[] | Record<string, string | Partial<StatusMeta>>>\n}\n` +
    `export const BRANDS: Record<string, Brand> = ${JSON.stringify(cfg.brands ?? {}, null, 2)}\n\n` +
    `export interface AppPreview {\n  forProject?: string\n  name: string\n  screen: Record<string, unknown>\n}\n` +
    `export const APPS: AppPreview[] = ${JSON.stringify(cfg.apps ?? [], null, 2)}\n\n` +
    `export interface WebPreview {\n  forProject?: string\n  name: string\n  url?: string\n  title?: string\n  screen: Record<string, unknown>\n}\n` +
    `export const WEBSITES: WebPreview[] = ${JSON.stringify(cfg.websites ?? [], null, 2)}\n\n` +
    `export interface SummaryConfig {\n  heading: string\n  headers: string[]\n}\n` +
    `export const SUMMARY: SummaryConfig = ${JSON.stringify(cfg.summary, null, 2)}\n\n` +
    `export const PROJECTS_ROOT = ${JSON.stringify(cfg.projectsRoot)}\n`
  writeFileSync(APPCONFIG_FILE, code, 'utf8')
}

export function main() {
  const { projects, docs } = collect()
  writeDocs(docs, projects)
  writeAppConfig()
  console.log(`[sync-docs] appconfig → ${APPCONFIG_FILE}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main()
}