#!/usr/bin/env node
/**
 * sync-adr.mjs
 *
 * Escanea carpetas de Architecture Decision Records (ADR) en cada proyecto de
 * projectsRoot y genera:
 *   - src/generated/adr.ts → AdrRecord[] (registros con secciones, status y relaciones)
 *
 * Reusa el mismo patrón de line-ranges que sync-docs.mjs para que el write-back
 * (assembleAdr) funcione igual sin reescribir esa lógica.
 *
 * Opciones:
 *   --lint   no escribe nada; reporta relaciones rotas/secciones faltantes y
 *            termina con código de salida != 0 si hay algo (npm run adr:lint).
 */
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { join, basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import toml from 'toml'
import { loadConfig } from './config.mjs'

const cfg = loadConfig()
const PROYECTOS_DIR = cfg.projectsAbs
const OUT_DIR = cfg.outputAbs
const OUT_FILE = join(OUT_DIR, 'adr.ts')

const SELF = 'proyectos-board'
const SKIP = new Set([SELF, 'node_modules', '.git', '.expo', 'dist', '.vscode', '.claude', '.idea', 'android', 'ios'])

const RELATION_KEYS = new Set(['supersedes', 'superseded_by', 'related_to', 'depends_on'])

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Normaliza una referencia "0007" o "0007-titulo" a su id numérico canónico. */
export function normAdrRef(ref) {
  if (typeof ref === 'number') return String(ref)
  const m = String(ref ?? '').match(/(\d{3,})/)
  return m ? String(Number(m[1])) : String(ref ?? '').trim()
}

function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

/** Detecta status por texto plano (fallback cuando no hay front-matter). */
export function detectStatusHeuristic(text, statusList) {
  const lower = text.toLowerCase()
  for (const s of statusList) {
    const terms = [s.key, s.label, s.plural, s.emoji].filter(Boolean)
    const re = new RegExp(`(?:\\bstatus\\b\\s*[:\\-]?\\s*)?(${terms.map(escapeRe).join('|')})`, 'i')
    if (re.test(lower.slice(0, 2000))) return s.key
  }
  const defaultKey = statusList[0]?.key
  return defaultKey && /accepted/.test(lower) ? 'accepted' : (defaultKey ?? 'proposed')
}

/** Divide un documento ADR en secciones H2, como en sync-docs.mjs. */
const SECTION_HEADING = /^##\s+(.+)$/

/**
 * Extrae el front-matter del ADR, soportando los tres formatos:
 *   --- YAML (default) · +++ TOML · ;;; JSON
 * Deja `{}` si no hay front-matter válido (nunca lanza).
 */
export function parseAdrFrontmatter(raw) {
  let opts
  if (raw.startsWith('+++')) {
    opts = { delimiters: '+++', language: 'toml', engines: { toml: { parse: (s) => toml.parse(s) } } }
  } else if (raw.startsWith(';;;')) {
    opts = { delimiters: ';;;', language: 'json' }
  }
  try {
    const parsed = matter(raw, opts)
    return parsed.data && typeof parsed.data === 'object' ? parsed.data : {}
  } catch {
    return {}
  }
}

export function parseAdrFile(filePath, projectName, adrStatusList) {
  const raw = readFileSync(filePath, 'utf8')
  const lines = raw.split('\n')
  const file = basename(filePath)

  const fm = parseAdrFrontmatter(raw)

  const idMatch = file.match(/^(\d{3,})[-_]/)
  const titleLine = lines.find((l) => /^#\s+/.test(l))
  const titleMatch = titleLine?.match(/^#\s+(?:\d{3,}[.\s-]+\s*)?(.+)$/)
  const id = idMatch ? idMatch[1] : (titleLine?.match(/^#\s+(\d{3,})[.\s-]/)?.[1] ?? basename(file, extname(file)))
  const title = titleMatch ? titleMatch[1].trim() : titleLine?.replace(/^#\s+/, '').trim() ?? file

  // sections H2 (Context / Decision / Consequences, y cualquier otra)
  const sections = []
  let current = null
  let firstH2 = -1
  const flush = (heading, start, end) => {
    const rawBlock = lines.slice(start, end + 1).join('\n')
    if (!rawBlock.trim()) return
    const slug = heading.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
    sections.push({
      id: `${id}-${slug}`,
      heading: heading.trim(),
      raw: rawBlock,
      startLine: start + 1,
      endLine: end + 1,
    })
  }
  for (let i = 0; i < lines.length; i++) {
    const m = SECTION_HEADING.exec(lines[i])
    if (m) {
      if (firstH2 === -1) firstH2 = i
      if (current) flush(current.heading, current.start, i - 1)
      current = { heading: m[1], start: i }
    }
  }
  if (current) flush(current.heading, current.start, lines.length - 1)

  const introRaw = lines.slice(0, firstH2 === -1 ? lines.length : firstH2).join('\n').replace(/^\n+/, '').trimEnd()
  const introEndLine = firstH2 === -1 ? lines.length - 1 : firstH2 - 1

  // status: front-matter → texto plano → default
  let status = String(fm.status ?? '').trim()
  if (!status) status = detectStatusHeuristic(raw, adrStatusList)
  if (!adrStatusList.some((s) => s.key === status)) status = adrStatusList[0]?.key ?? 'proposed'

  const date = fm.date
    ? fm.date instanceof Date
      ? fm.date.toISOString().slice(0, 10)
      : String(fm.date)
    : null
  const deciders = Array.isArray(fm.deciders) ? fm.deciders.map(String) : []

  // relaciones declaradas
  const relations = []
  for (const type of RELATION_KEYS) {
    const list = fm[type]
    if (list === undefined) continue
    const targets = Array.isArray(list) ? list : [list]
    for (const t of targets) {
      if (t === undefined || t === null || t === '') continue
      relations.push({ type, targetId: normAdrRef(t) })
    }
  }

  return {
    id,
    project: projectName,
    file,
    title,
    status,
    date,
    deciders,
    sections,
    relations,
    intro: introRaw,
    introEndLine,
    startLine: 1,
    endLine: lines.length,
    raw,
    sha: hash(raw),
    lines: lines.length,
    bytes: raw.length,
  }
}

export function collectAdrs() {
  const projects = readdirSync(PROYECTOS_DIR)
    .filter((name) => !SKIP.has(name) && !name.startsWith('.'))
    .map((name) => {
      const dir = join(PROYECTOS_DIR, name)
      try {
        return statSync(dir).isDirectory() ? { name, dir } : null
      } catch {
        return null
      }
    })
    .filter(Boolean)

  const adrs = []
  for (const p of projects) {
    for (const rel of cfg.adr.paths) {
      const target = join(p.dir, rel)
      let files = []
      try {
        files = readdirSync(target).filter((f) => extname(f).toLowerCase() === '.md')
      } catch {
        continue
      }
      for (const f of files.sort()) {
        adrs.push(parseAdrFile(join(target, f), p.name, cfg.adr.status))
      }
    }
  }

  // resolver existencia de relaciones dentro del mismo proyecto y apuntar al id real
  for (const a of adrs) {
    const realById = new Map(
      adrs.filter((x) => x.project === a.project).map((x) => [normAdrRef(x.id), x.id])
    )
    a.broken = []
    const seen = new Set()
    const kept = []
    for (const r of a.relations) {
      if (seen.has(r.type + ':' + r.targetId)) continue
      seen.add(r.type + ':' + r.targetId)
      const realId = realById.get(r.targetId)
      if (!realId) {
        a.broken.push(`${r.type}:${r.targetId}`)
        kept.push(r)
      } else {
        kept.push({ ...r, targetId: realId })
      }
    }
    a.relations = kept
  }

  adrs.sort((a, b) => a.project.localeCompare(b.project) || a.file.localeCompare(b.file))
  return adrs
}

export function writeAdrs(adrs) {
  const generatedAt = new Date().toISOString()
  const statusMeta = cfg.adr.status.map((s) => ({ key: s.key, emoji: s.emoji, label: s.label, plural: s.plural }))
  const byProject = {}
  for (const a of adrs) {
    byProject[a.project] ??= []
    byProject[a.project].push({ ...a, statusMeta })
  }
  const code =
    `// AUTO-GENERADO por scripts/sync-adr.mjs — NO editar a mano.\n` +
    `// Fuente: carpetas ADR (${JSON.stringify(cfg.adr.paths)}) en ${JSON.stringify(PROYECTOS_DIR)}\n` +
    `// Generado: ${generatedAt}\n\n` +
    `export type AdrStatus = 'proposed' | 'accepted' | 'rejected' | 'deprecated' | 'superseded' | (string & {})\n\n` +
    `export type AdrRelationType = 'supersedes' | 'superseded_by' | 'related_to' | 'depends_on'\n\n` +
    `export interface AdrStatusMeta {\n  key: string\n  emoji: string\n  label: string\n  plural: string\n}\n\n` +
    `export interface AdrRelation {\n  type: AdrRelationType\n  targetId: string\n}\n\n` +
    `export interface AdrSection {\n  id: string\n  heading: string\n  raw: string\n  startLine: number\n  endLine: number\n}\n\n` +
    `export interface AdrRecord {\n  id: string\n  project: string\n  file: string\n  title: string\n  status: AdrStatus\n  statusMeta: AdrStatusMeta[]\n  date: string | null\n  deciders: string[]\n  sections: AdrSection[]\n  relations: AdrRelation[]\n  broken: string[]\n  intro: string\n  introEndLine: number\n  startLine: number\n  endLine: number\n  raw: string\n  sha: string\n  lines: number\n  bytes: number\n}\n\n` +
    `export const ADR_STATUS_META: AdrStatusMeta[] = ${JSON.stringify(statusMeta, null, 2)}\n\n` +
    `export const ADRS: AdrRecord[] = ${JSON.stringify(adrs.map((a) => ({ ...a, statusMeta })), null, 2)}\n\n` +
    `export const adrsByProject: Record<string, AdrRecord[]> = ${JSON.stringify(byProject, null, 2)}\n`
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, code, 'utf8')
  const totalSections = adrs.reduce((acc, a) => acc + a.sections.length, 0)
  console.log(`[sync-adr] ${adrs.length} ADRs en ${Object.keys(byProject).length} proyectos (${totalSections} secciones) → ${OUT_FILE}`)
}

export function main() {
  const adrs = collectAdrs()
  const lint = process.argv.includes('--lint')
  const broken = adrs.flatMap((a) => a.broken.length ? a.broken.map((b) => `${a.project}/${a.file}: ${b}`) : [])
  const noContext = adrs.filter((a) => !a.sections.some((s) => s.heading.toLowerCase() === 'context'))
  if (lint) {
    for (const b of broken) console.error(`[adr:lint] relación rota → ${b}`)
    for (const a of noContext) console.error(`[adr:lint] falta sección Context → ${a.project}/${a.file}`)
    if (broken.length || noContext.length) process.exitCode = 1
    else console.log('[adr:lint] ok')
    return
  }
  writeAdrs(adrs)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main()
}