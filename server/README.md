# ADR Premium — webhook emisor de licencias

Función serverless gratuita (Vercel o Cloudflare Workers) que, al comprarse el
producto en **GitHub Sponsors**, **Gumroad** o **Lemon Squeezy**, firma un token
Ed25519 con tu clave **privada** y lo devuelve / lo manda por mail al comprador.
El bundle de repoDocs valida ese token **offline** con la clave pública embebida
(`src/lib/license.ts`).

## Arquitectura

- `server/sign.mjs` — firma/verificación Ed25519 + HMAC-SHA256 con APIs globales
  (sin Buffer/fs), corre en Node, Electron y edge runtimes.
- `server/webhook-core.mjs` — clasifica el payload (GitHub Sponsors `sponsorship`
  | Gumroad `sale` | Lemon Squeezy JSON:API), verifica la firma contra el
  **body raw**, filtra producto/refund/test-mode y emite el token.
- `api/webhook.mjs` — adaptador **Vercel** (`POST /api/webhook`).
- `server/webhook-worker.mjs` — adaptador **Cloudflare Worker**.
- `server/webhook-local.mjs` — listener local (`npm run webhook:local`) para
  probar con el botón de "test webhook" de las plataformas.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `ADRP_WEBHOOK_SECRET` | sí | Secreto al crear el webhook (reposo; también fallback por proveedor) |
| `ADRP_PRIVATE_KEY_HEX` | sí | Clave Ed25519 **privada** en hex (**nunca** en el repo) |
| `ADRP_PRODUCT_IDS` | salvo GitHub | Ids de producto (Gumroad = permalink; LS = product_id numérico). GitHub no la usa |
| `ADRP_GITHUB_TIER_IDS` | no | Tiers de Sponsors (node_id) que emiten premium; vacío = todos |
| `ADRP_GITHUB_SECRET` / `ADRP_GUMROAD_SECRET` / `ADRP_LEMONSQUEEZY_SECRET` | no | Secretos por plataforma; si faltan se usa `ADRP_WEBHOOK_SECRET` |
| `ADRP_SEATS` | no | Asientos por licencia (default `1`) |
| `ADRP_ACCEPT_TEST` | no | `1` para emitir también en compras de prueba |
| `ADRP_RESEND_KEY` / `ADRP_RESEND_FROM` | no | Envía el token por mail al comprador (Resend) |

## Prueba local

```bash
npm run webhook:local
# en otra terminal:
curl -X POST http://localhost:8787/webhook \
  -H 'content-type: application/json' \
  -H 'x-gumroad-signature: <hmac-hex>' \
  --data '{"sale":{"id":"x","product_id":"repodocs-adr-premium","email":"tucorreo@demo.com"}}'
```

Para generar la firma con tu secreto:

```bash
node -e "const{crypto}=await import('node:crypto'); const h=crypto.createHmac('sha256',process.env.ADRP_WEBHOOK_SECRET).update(process.argv[1]).digest('hex'); process.stdout.write(h)" "$(cat payload.txt)"
```

Los tests (`npm test`) cubren GitHub Sponsors, Gumroad, Lemon Squeezy, firma
mala, refunds, test-mode, producto no permitido y el round-trip con `verifyEd25519`.

## GitHub Sponsors (el camino más simple)

El webhook de Sponsors **solo lo puede crear el dueño de la cuenta** desde el
dashboard de Sponsors — GitHub no expone API para esto (y el evento
`sponsorship` no se puede suscribir en webhooks de repos/orgs). Es el único
paso manual, y se hace una sola vez:

1. Abrí tu dashboard de Sponsors → **Webhooks** (link directo:
   `https://github.com/sponsors/TU-USUARIO/dashboard/webhooks`).
2. **Add webhook**:
   - **Payload URL**: `https://TU-APP.vercel.app/api/webhook`
   - **Content type**: `application/json`
   - **Secret**: el mismo `ADRP_WEBHOOK_SECRET` que puse en Vercel
   - **Active**: sí → **Create webhook**.
3. GitHub te manda un ping de prueba: el webhook lo responde `200 ok`
   (`github:ping`) automaticamente.

Cuando llegue el primer `sponsorship.created`, GitHub firma el body con
`X-Hub-Signature-256: sha256=<hmac hex>` del mismo secreto (`ADRP_GITHUB_SECRET`
o fallback `ADRP_WEBHOOK_SECRET`), y por defecto **cualquier tier emite la
licencia** (podés restringir con `ADRP_GITHUB_TIER_IDS` = node_ids de tiers).
Como el email del sponsor no viaja en el payload, se usa su login
(`<login>@users.noreply.github.com`) salvo que lo haga público.

## Deploy con Vercel

1. Subí `feat/adr-premium` a GitHub (si aún no está en `main`, deployá esta rama:
   Vercel → Project → import → Rama: `feat/adr-premium`).
2. Vercel detecta Vite → build estático. La carpeta `api/` se despliega sola como
   serverless function → endpoint `https://TU-APP.vercel.app/api/webhook`.
3. Settings → Environment Variables: `ADRP_WEBHOOK_SECRET`, `ADRP_PRIVATE_KEY_HEX`
   (la línea final de `~/proyectos/repodocs-adr-premium-private.txt`),
   `ADRP_PRODUCT_IDS`, y opcionalmente `ADRP_GITHUB_TIER_IDS`,
   `ADRP_RESEND_KEY`/`ADRP_RESEND_FROM`.
4. Redeploy (durante build/carga) y probá con un `curl` a
   `https://TU-APP.vercel.app/api/webhook`.
5. GitHub Sponsors: creá el webhook sobre el repo (arriba). Gumroad: Advanced
   settings → Webhook, apuntalo a esa URL y pegá el mismo secreto. Lemon
   Squeezy: Settings → Webhooks → "+" → URL + secreto + evento `order_created`
   (y opcionalmente `order_refunded`).

## Deploy con Cloudflare Workers

```bash
cd server
npx wrangler deploy --name repodocs-license-webhook webhook-worker.mjs
# secrets (en vez de vars visibles):
npx wrangler secret put ADRP_PRIVATE_KEY_HEX
npx wrangler secret put ADRP_WEBHOOK_SECRET
npx wrangler secret put ADRP_PRODUCT_IDS
```

El Worker se invoca en la raíz del workers.dev (`https://TU-WORKER.workers.dev`) —
ese es el URL del webhook.

## Notas

- **Sin backend propio de almacenamiento**: el webhook emite por evento de
  compra. Un mismo comprador puede regenerar el token re-triggerando el evento;
  si querés idempotencia/revocación, agregá una KV/DB con el `order_id` (roadmap).
- El token NO expira (lifetime, spec §6.4 / política de versionado).
- Refunds y compras en test-mode **no** emiten licencia (salvo `ADRP_ACCEPT_TEST=1`).