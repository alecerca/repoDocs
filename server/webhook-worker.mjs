/**
 * Cloudflare Worker — exporta `fetch`, emisor de licencias ADR Premium.
 *
 * Deploy:
 *   npx wrangler deploy --name repodocs-license-webhook worker.js
 *   (o apuntar el "main" del wrangler.toml a este archivo)
 */
import { handleWebhook } from './webhook-core.mjs'

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'method-not-allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' },
      })
    }
    const rawBody = await request.text()
    const headers = Object.fromEntries(request.headers.entries())
    const out = await handleWebhook({ rawBody, headers, env })
    return new Response(JSON.stringify(out.json), {
      status: out.status,
      headers: { 'content-type': 'application/json' },
    })
  },
}

export { handleWebhook }