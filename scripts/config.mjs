/**
 * config.mjs
 *
 * Carga mdboard.json (defaults públicos) y lo mezcla con mdboard.local.json
 * (override local, gitignoreado). Devuelve la config resuelta con rutas absolutas.
 *
 * Lo usan: scripts/sync-docs.mjs y vite.config.ts (write-back).
 */
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base
  if (override === null || override === undefined) return base
  if (typeof base !== 'object' || base === null) return override
  const out = { ...base }
  for (const [k, v] of Object.entries(override)) {
    out[k] = deepMerge(out[k], v)
  }
  return out
}

export const PKG = PKG_ROOT

export function loadConfig() {
  const base = readJson(join(PKG_ROOT, 'mdboard.json')) ?? {}
  const local = readJson(join(PKG_ROOT, 'mdboard.local.json')) ?? {}
  const merged = deepMerge(base, local)

  // Overrides por entorno (para scripts/smoke, CI, etc.)
  if (process.env.MDBOARD_ROOT) merged.projectsRoot = process.env.MDBOARD_ROOT

  const projectsRoot = merged.projectsRoot ?? './examples'
  const outputDir = merged.outputDir ?? './src/generated'
  const status = Array.isArray(merged.status) ? merged.status : []
  const brands = merged.brands ?? {}
  const apps = Array.isArray(merged.apps) ? merged.apps : []
  const websites = Array.isArray(merged.websites) ? merged.websites : []
  const summary = { heading: 'Resumen de estado', headers: ['#', 'Tema', 'Estado'], ...(merged.summary ?? {}) }

  return {
    ...merged,
    projectsRoot,
    projectsAbs: resolve(PKG_ROOT, projectsRoot),
    outputDir,
    outputAbs: resolve(PKG_ROOT, outputDir),
    status,
    brands,
    apps,
    websites,
    summary,
    pkgRoot: PKG_ROOT,
  }
}