/**
 * Listener local del webhook — para probar con el botón
 * "Send a test webhook" de Gumroad / el simulador de Lemon Squeezy
 * (o un `curl`) sin desplegar nada.
 *
 *   npm run webhook:local
 *   curl -X POST http://localhost:8787/webhook -H 'content-type: application/json' ...
 */
import { createServer } from 'node:http'
import { handleWebhook } from './webhook-core.mjs'

const PORT = Number(process.env.PORT ?? 8787)

const server = createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('POST only')
    return
  }
  const chunks = []
  for await (const c of req) chunks.push(c)
  const rawBody = Buffer.concat(chunks).toString('utf8')
  const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
  const out = await handleWebhook({ rawBody, headers, env: process.env })
  res.writeHead(out.status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(out.json, null, 2))
})

server.listen(PORT, () => {
  console.log(`ADR Premium webhook listener → http://localhost:${PORT}/webhook`)
  console.log('Secrets requeridas (env): ADRP_WEBHOOK_SECRET y ADRP_PRIVATE_KEY_HEX (además ADRP_PRODUCT_IDS)')
})