/**
 * Vercel serverless function — POST /api/webhook
 * Detectada automáticamente por Vercel desde la carpeta api/ (Node runtime, Web Signature).
 */
import { handleWebhook } from '../server/webhook-core.mjs'

export default {
  async fetch(request) {
    const rawBody = await request.text()
    const headers = Object.fromEntries(request.headers.entries())
    const out = await handleWebhook({ rawBody, headers, env: process.env })
    return new Response(JSON.stringify(out.json), {
      status: out.status,
      headers: { 'content-type': 'application/json' },
    })
  },
}