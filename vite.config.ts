import react from '@vitejs/plugin-react'
import { defineConfig, type PluginOption } from 'vite'
import { dirname, join, resolve, sep } from 'node:path'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
// @ts-expect-error — scripts/config.mjs es el loader (sin declaraciones TS)
import { loadConfig } from './scripts/config.mjs'

type PreviewServer = { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void) => void }; ws?: { send: (payload: unknown) => void } }

/**
 * Write-back de la UI a los .md reales y sincronización con GitHub.
 * POST /__mdboard/write { project, file, content } → escribe el archivo y regenera los docs.
 * POST /__mdboard/github/pull { repo, branch, files } → guarda archivos .md de un repo remoto y regenera los docs.
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
            const safeFile = file.replace(/\\/g, '/').replace(/^\/+/, '')
            if (!/\.md$/i.test(safeFile) || safeFile.includes('..')) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'solo se escriben archivos .md' }))
              return
            }
            const cfg = loadConfig()
            const projectDir = resolve(cfg.projectsAbs, project)
            if (!/^[a-z0-9][a-z0-9 _-]*$/i.test(project) || !existsSync(projectDir) || !statSync(projectDir).isDirectory()) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'proyecto inválido o no encontrado' }))
              return
            }
            const target = resolve(projectDir, safeFile)
            const boundary = projectDir.endsWith(sep) ? projectDir : projectDir + sep
            if (!target.startsWith(boundary)) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'acceso fuera de la carpeta del proyecto' }))
              return
            }
            if (!existsSync(target)) {
              res.statusCode = 409
              res.end(JSON.stringify({ ok: false, error: 'el archivo no existe' }))
              return
            }
            writeFileSync(target, content, 'utf8')
            try {
              execFileSync(process.execPath, [join(cfg.pkgRoot, 'scripts', 'sync-docs.mjs')], { stdio: 'ignore' })
            } catch {
              /* ignore */
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
      if (req.method === 'POST' && req.url === '/github/pull') {
        if (!writeEnabled()) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'write desactivado (MDBOARD_NO_WRITE=1)' }))
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          if (body.length > 50_000_000) {
            req.destroy()
            return
          }
          body += chunk.toString()
        })
        req.on('end', () => {
          try {
            const payload = JSON.parse(body) as { repo?: unknown; branch?: unknown; files?: unknown }
            const { repo, files } = payload
            if (typeof repo !== 'string' || !Array.isArray(files)) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'se espera { repo, files: [] }' }))
              return
            }
            const repoBase = repo.includes('/') ? repo.split('/').slice(-1)[0] : repo
            const cleanRepo = repoBase.trim().replace(/[^a-zA-Z0-9._-]/g, '_')
            if (!cleanRepo || cleanRepo === '.' || cleanRepo === '..' || cleanRepo.startsWith('_')) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'nombre de repo inválido' }))
              return
            }
            const cfg = loadConfig()
            const repoDir = resolve(cfg.projectsAbs, cleanRepo)
            const allowedDir = resolve(cfg.projectsAbs)
            const allowedBoundary = allowedDir.endsWith(sep) ? allowedDir : allowedDir + sep
            if (!repoDir.startsWith(allowedBoundary)) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'intento de escape de directorio detectado' }))
              return
            }
            mkdirSync(repoDir, { recursive: true })
            const repoBoundary = repoDir.endsWith(sep) ? repoDir : repoDir + sep
            let writtenCount = 0
            for (const item of files) {
              if (!item || typeof item.path !== 'string' || typeof item.content !== 'string') {
                continue
              }
              const relPath = item.path.replace(/\\/g, '/').trim()
              if (relPath.startsWith('/') || relPath.includes('..')) {
                res.statusCode = 400
                res.end(JSON.stringify({ ok: false, error: 'ruta de archivo inválida: ' + relPath }))
                return
              }
              if (!/\.md$/i.test(relPath)) {
                continue
              }
              const targetPath = resolve(repoDir, relPath)
              if (!targetPath.startsWith(repoBoundary)) {
                res.statusCode = 400
                res.end(JSON.stringify({ ok: false, error: 'archivo fuera de la carpeta del repo' }))
                return
              }
              mkdirSync(dirname(targetPath), { recursive: true })
              writeFileSync(targetPath, item.content, 'utf8')
              writtenCount++
            }
            try {
              execFileSync(process.execPath, [join(cfg.pkgRoot, 'scripts', 'sync-docs.mjs')], { stdio: 'ignore' })
            } catch {
              /* ignore */
            }
            server.ws?.send({ type: 'full-reload' })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, project: cleanRepo, count: writtenCount }))
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