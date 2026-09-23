#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { loadConfig } from './config.mjs'
import { loadPlugins } from './plugins.mjs'

const cfg = loadConfig()
const PROYECTOS_DIR = cfg.projectsAbs
const OUT_DIR = cfg.outputAbs
const OUT_FILE = join(OUT_DIR, 'docs.ts')
const APPCONFIG_FILE = join(OUT_DIR, 'appconfig.ts')

const SELF = 'proyectos-board'
const SKIP = new Set([SELF, 'node_modules', '.git', '.expo', 'dist', '.vscode', '.claude', '.idea', 'android', 'ios'])

const STATUS_PATTERNS = cfg.status.map((s) => ({
  key: s.key,
  label: s.label,
  emoji: s.emoji,
  plural: s.plural,
  re: new RegExp(`${escapeRe(s.emoji)}|${s.hint ?? ''}`, 'i'),
}))

/**
 * Escapes regular expression special characters.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Detects status indicators based on configured status emojis and hints.
 *
 * @param {string} text
 * @returns {Array<{ key: string }>}
 */
function detectStatus(text) {
  const counts = {}
  for (const s of STATUS_PATTERNS) counts[s.key] = 0
  for (const s of STATUS_PATTERNS) {
    const matches = text.match(s.re)
    if (matches) counts[s.key] = matches.length
  }
  const order = STATUS_PATTERNS.map((s) => s.key)
  return order
    .filter((k) => (counts[k] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .map((k) => ({ key: k }))
}

/**
 * Converts a section heading or raw snippet into a URL-friendly slug.
 *
 * @param {string} str
 * @param {number} idx
 * @returns {string}
 */
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

/**
 * Normalizes a table cell by stripping formatting.
 *
 * @param {string} cell
 * @returns {string}
 */
function normalizeCell(cell) {
  return cell.toLowerCase().replace(/[*`]/g, '').trim()
}

/**
 * Parses markdown table rows between line indices.
 *
 * @param {string[]} lines
 * @param {number} startLine
 * @param {number} endLine
 * @returns {string[][]}
 */
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
 * Finds and parses the default summary table in a document.
 *
 * @param {string[]} lines
 * @returns {{ startLine: number, endLine: number, entries: Array<{ num: string, tema: string, estado: string }> } | null}
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

/**
 * Parses a markdown document, invoking plugin hooks for custom importing and metadata extraction.
 *
 * @param {string} filePath
 * @param {string} projectName
 * @param {import('./plugins.mjs').PluginManager} pluginManager
 * @returns {Object}
 */
function parseDoc(filePath, projectName, pluginManager) {
  const raw = readFileSync(filePath, 'utf8')
  const file = basename(filePath)
  const context = { filePath, projectName, file, raw, config: cfg, extra: {} }

  const beforeResult = pluginManager.runBeforeParse(context)
  const parsedRaw = beforeResult.raw
  context.extra = beforeResult.extra

  const lines = parsedRaw.split('\n')

  const defaultTitleMatch = parsedRaw.match(/^#\s+(.+)$/m)
  const defaultTitle = defaultTitleMatch ? defaultTitleMatch[1].trim() : basename(filePath, extname(filePath))

  const defaultSubMatch = parsedRaw.match(/^#\s+.+\n+(>.*(?:\n>.*)*)/)
  const defaultSubtitle = defaultSubMatch ? defaultSubMatch[1].trim().replace(/^>\s?/gm, '') : ''

  const customTitle = pluginManager.runParseTitle({
    ...context,
    lines,
    title: defaultTitle,
    subtitle: defaultSubtitle,
  })

  const title = customTitle?.title ?? defaultTitle
  const subtitle = customTitle?.subtitle ?? defaultSubtitle

  const customSummary = pluginManager.runParseSummaryTable({ ...context, lines })
  const summary = customSummary ?? findSummaryTable(lines)

  const sections = []
  let current = null
  let firstH2 = -1

  const flush = (heading, start, end, headingLevel) => {
    const rawBlock = lines.slice(start, end + 1).join('\n')
    if (!rawBlock.trim()) return

    const customStatus = pluginManager.runDetectStatus({ ...context, text: rawBlock })
    const statuses = (customStatus ?? detectStatus(rawBlock)).map((s) => s.key ?? s)

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

  const customSections = pluginManager.runParseSections({ ...context, lines })

  if (Array.isArray(customSections)) {
    sections.push(...customSections)
  } else {
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
  }

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

  const statusCounts = { done: 0, pending: 0, progress: 0 }
  for (const s of sections) {
    if (s.status) statusCounts[s.status]++
  }

  const baseDoc = {
    file: basename(filePath),
    path: filePath,
    project: projectName,
    title,
    subtitle,
    raw,
    intro: introRaw,
    introEndLine: firstH2 === -1 ? lines.length - 1 : firstH2 - 1,
    sections,
    summary: summary ? { entries: summary.entries, headers: summary.headers } : null,
    statusCounts,
    sha: hash(raw),
    lines: raw.split('\n').length,
    bytes: raw.length,
    ...(context.extra.frontmatter ? { frontmatter: context.extra.frontmatter } : {}),
    ...(context.extra.metadata ? { metadata: context.extra.metadata } : {}),
    ...(context.extra._frontmatterRaw ? { _frontmatterRaw: context.extra._frontmatterRaw } : {}),
  }

  return pluginManager.runAfterParse({ ...context, doc: baseDoc })
}

/**
 * Computes a fast string hash code.
 *
 * @param {string} str
 * @returns {string}
 */
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

/**
 * Collects and parses all markdown files across configured project directories.
 *
 * @param {import('./plugins.mjs').PluginManager} pluginManager
 * @returns {Promise<{ projects: number, docs: Array<Object> }>}
 */
async function collect(pluginManager) {
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
    for (const md of p.mds) {
      docs.push(parseDoc(join(p.dir, md), p.name, pluginManager))
    }
  }
  docs.sort((a, b) => a.project.localeCompare(b.project) || a.file.localeCompare(b.file))
  return { projects: projects.length, docs }
}

/**
 * Emits the generated docs.ts source file.
 *
 * @param {Array<Object>} docs
 * @param {number} projectsCount
 * @returns {void}
 */
function writeDocs(docs, projectsCount) {
  const generatedAt = new Date().toISOString()
  const code =
    `// AUTO-GENERADO por scripts/sync-docs.mjs — NO editar a mano.\n` +
    `// Fuente: *.md de cada proyecto en ${JSON.stringify(PROYECTOS_DIR)}\n` +
    `// Generado: ${generatedAt}\n\n` +
    `export interface DocSummaryEntry {\n  num: string\n  tema: string\n  estado: string\n}\n\n` +
    `export type DocStatus = 'done' | 'pending' | 'progress'\n\n` +
    `export interface DocSection {\n  id: string\n  heading: string | null\n  level: number\n  kind: 'section' | 'chunk' | 'summary'\n  raw: string\n  startLine: number\n  endLine: number\n  status: DocStatus | null\n}\n\n` +
    `export interface Doc {\n  file: string\n  path: string\n  project: string\n  title: string\n  subtitle: string\n  raw: string\n  intro: string\n  introEndLine: number\n  sections: DocSection[]\n  summary: { entries: DocSummaryEntry[]; headers?: string[] } | null\n  statusCounts: Record<DocStatus, number>\n  sha: string\n  lines: number\n  bytes: number\n  frontmatter?: Record<string, unknown>\n  metadata?: Record<string, unknown>\n  _frontmatterRaw?: string\n}\n\n` +
    `export const DOCS: Doc[] = ${JSON.stringify(docs, null, 2)}\n`
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, code, 'utf8')
  const totalSections = docs.reduce((acc, d) => acc + d.sections.length, 0)
  console.log(`[sync-docs] ${docs.length} docs en ${projectsCount} proyectos (${totalSections} secciones) → ${OUT_FILE}`)
}

/**
 * Emits the generated appconfig.ts source file.
 *
 * @returns {void}
 */
function writeAppConfig() {
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
    `export interface Brand {\n  name: string\n  tagline: string\n  accent: string\n  accent2: string\n  darkBg: string\n  surface: string\n  surfaceAlt: string\n  text: string\n  muted: string\n  palette: string[]\n  stack: string[]\n}\n` +
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

/**
 * Main entrypoint for sync-docs.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const pluginManager = await loadPlugins(cfg)
  const { projects, docs } = await collect(pluginManager)
  writeDocs(docs, projects)
  writeAppConfig()
  console.log(`[sync-docs] appconfig → ${APPCONFIG_FILE}`)
}

await main()