/**
 * Vercel serverless function — POST /api/webhook
 * (desplegada automáticamente por Vercel desde la carpeta api/ con preset Vite)
 */
import { handleWebhook } from '../server/webhook-core.mjs'

export default async function handler(req, res) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const rawBody = Buffer.concat(chunks).toString('utf8')
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  )
  const out = await handleWebhook({ rawBody, headers, env: process.env })
  res.status(out.status).json(out.json)
}