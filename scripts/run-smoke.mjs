#!/usr/bin/env node
/**
 * run-smoke.mjs
 *
 * Levanta `vite preview` en :5199 con MDBOARD_NO_WRITE=1 (para que las
 * ediciones del smoke NO toquen los .md reales), corre scripts/smoke.mjs y
 * cierra el preview al terminar.
 *
 * Uso: npm run smoke
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5199
const BASE = `http://localhost:${PORT}/`

const preview = spawn(
  join(ROOT, 'node_modules', '.bin', 'vite'),
  ['preview', '--port', String(PORT), '--strictPort'],
  {
    cwd: ROOT,
    env: { ...process.env, MDBOARD_NO_WRITE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }
)
preview.stdout.on('data', (d) => process.stdout.write(d))
preview.stderr.on('data', (d) => process.stdout.write(d))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE, { method: 'HEAD' })
      if (res.ok || res.status < 500) return
    } catch {
      /* aún no levanta */
    }
    await sleep(300)
  }
  throw new Error(`Preview no levantó en ${BASE}`)
}

let exitCode = 1
try {
  await waitForServer()
  await import('./smoke.mjs')
  exitCode = process.exitCode || 0
} catch (err) {
  console.error('[run-smoke]', err.message)
  exitCode = 1
} finally {
  preview.kill('SIGTERM')
}

await sleep(300)
process.exit(exitCode)