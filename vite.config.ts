import react from '@vitejs/plugin-react'
import { defineConfig, type PluginOption } from 'vite'
import { basename, join } from 'node:path'
import { existsSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
// @ts-expect-error — scripts/config.mjs es el loader (sin declaraciones TS)
import { loadConfig } from './scripts/config.mjs'

type PreviewServer = { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void) => void }; ws?: { send: (payload: unknown) => void } }

/**
 * Write-back de la UI a los .md reales.
 * POST /__mdboard/write { project, file, content } → escribe el archivo y
 * regenera los docs (sync). En `dev` Vite recarga solo (HMR); en `preview`
 * la data fresca se ve al reconstruir.
 * GET  /__mdboard/health → { ok, write, root } para la UI.
 */
function mdboardPlugin(): PluginOption {
  const writeEnabled = () => process.env.MDBOARD_NO_WRITE !== '1'
  const install = (server: PreviewServer) => {
    const handle = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, write: writeEnabled(), root: loadConfig().projectsRoot }))
        return
      }
      if (req.method === 'POST' && req.url === '/write') {
        if (!writeEnabled()) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'write desactivado (MDBOARD_NO_WRITE=1)' }))
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          if (body.length > 5_000_000) {
            req.destroy()
            return
          }
          body += chunk.toString()
        })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body) as { project?: unknown; file?: unknown; content?: unknown }
            const { project, file, content } = payload
            if (typeof project !== 'string' || typeof file !== 'string' || typeof content !== 'string') {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'se espera { project, file, content }' }))
              return
            }
            const safeFile = basename(file)
            if (!/\.md$/i.test(safeFile)) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'solo se escriben archivos .md' }))
              return
            }
            const cfg = loadConfig()
            const projectDir = join(cfg.projectsAbs, project)
            if (!/^[a-z0-9][a-z0-9 _-]*$/i.test(project) || !existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'proyecto inválido o no encontrado' }))
              return
            }
            const target = join(projectDir, safeFile)
            if (!existsSync(target)) {
              res.statusCode = 409
              res.end(JSON.stringify({ ok: false, error: 'el archivo no existe' }))
              return
            }
            writeFileSync(target, content, 'utf8')
            try {
              execFileSync(process.execPath, [join(cfg.pkgRoot, 'scripts', 'sync-docs.mjs')], { stdio: 'ignore' })
            } catch {
              /* la data fresca llega en el próximo dev/build */
            }
            server.ws?.send({ type: 'full-reload' })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, path: target }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }))
          }
        })
        return
      }
      next()
    }
    server.middlewares.use('/__mdboard', handle)
  }

  return {
    name: 'mdboard-writeback',
    configureServer(server) {
      install(server as unknown as PreviewServer)
    },
    configurePreviewServer(server) {
      install(server as unknown as PreviewServer)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GH_PAGES === '1' ? '/repoDocs/' : '/',
  plugins: [react(), mdboardPlugin()],
})