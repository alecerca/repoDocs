/**
 * webhook-core.mjs — emisor de licencias ADR Premium vía webhook de pago.
 *
 * Función serverless agnóstica de plataforma: detecta el proveedor por la
 * estructura del payload (Gumroad "sale" | Lemon Squeezy JSON:API con
 * meta.event_name | GitHub Sponsors "sponsorship"), verifica la firma HMAC-SHA256
 * contra el body RAW y, si la compra corresponde a tu producto, firma un token
 * Ed25519 (idéntico al que el bundle valida en src/lib/license.ts).
 *
 * Env:
 *   ADRP_WEBHOOK_SECRET / ADRP_GUMROAD_SECRET / ADRP_LEMONSQUEEZY_SECRET / ADRP_GITHUB_SECRET — secreto webhook
 *   ADRP_PRODUCT_IDS          — ids de producto permitidos (separados por coma; LS usa el product_id numérico)
 *   ADRP_GITHUB_TIER_IDS      — opcional: node_ids de tiers de Sponsors que habilitan premium (vacío = todos)
 *   ADRP_PRIVATE_KEY_HEX      — clave Ed25519 PRIVADA (hex). NUNCA en el repo.
 *   ADRP_SEATS                — asientos por licencia (default 1)
 *   ADRP_ACCEPT_TEST=1        — emite también con compras en modo test
 *   ADRP_RESEND_KEY, ADRP_RESEND_FROM — (opcional) envía el token por mail con Resend
 *
 * El token regresa en el body JSON y —si hay ADRP_RESEND_KEY— se manda por mail.
 */
import { PRODUCT_ID, signEd25519, hmacSha256Hex, timingSafeEqualText, b64urlDecode } from './sign.mjs'

export const LICENSE_PRODUCT_ID = PRODUCT_ID

export function pick(env, names) {
  for (const n of names) {
    const v = env[n]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

export function classify(rawBody, headers) {
  let json
  try {
    json = JSON.parse(rawBody)
  } catch {
    return null
  }
  if (json && typeof json.sale === 'object' && json.sale !== null) {
    const s = json.sale
    return {
      provider: 'gumroad',
      payload: json,
      order: {
        order_id: s.id ?? s.purchase_id ?? null,
        product_id: s.product_id ?? null,
        email: s.email ?? null,
        name: s.full_name ?? null,
        refunded: s.refunded === true,
        recurrence: s.recurrence ?? null,
        test_mode: !!s.test,
      },
    }
  }
  if (json && json.meta && typeof json.meta.event_name === 'string') {
    const a = json?.data?.attributes ?? {}
    const firstItem = a.first_order_item ?? {}
    return {
      provider: 'lemonsqueezy',
      payload: json,
      order: {
        order_id: json?.data?.id ?? null,
        product_id: firstItem.product_id ?? null,
        email: a.user_email ?? null,
        name: a.user_name ?? null,
        refunded: a.refunded === true,
        recurrence: null,
        test_mode: a.test_mode === true || firstItem.test_mode === true || (a.status !== 'paid' && a.status !== undefined),
      },
    }
  }
  if (json && typeof json.sponsorship === 'object' && json.sponsorship !== null && typeof json.action === 'string') {
    const sp = json.sponsorship
    const sponsor = sp.sponsor ?? {}
    const tier = sp.tier ?? {}
    return {
      provider: 'github',
      payload: json,
      order: {
        order_id: sp.node_id ?? null,
        product_id: tier.node_id ?? null,
        email: sponsor.email ?? (sponsor.login ? `${sponsor.login}@users.noreply.github.com` : null),
        name: sponsor.name ?? sponsor.login ?? null,
        refunded: false,
        recurrence: tier.is_one_time === true ? 'one_time' : 'monthly',
        test_mode: false,
      },
    }
  }
  return null
}

function signatureHeader(headers, provider) {
  if (provider === 'gumroad') return headers['x-gumroad-signature'] ?? headers['X-Gumroad-Signature']
  if (provider === 'github') return headers['x-hub-signature-256'] ?? headers['X-Hub-Signature-256']
  return headers['x-signature'] ?? headers['X-Signature']
}

async function verifySignature({ rawBody, headers, provider, env }) {
  const secret = pick(env, provider === 'gumroad'
    ? ['ADRP_GUMROAD_SECRET', 'ADRP_WEBHOOK_SECRET']
    : provider === 'github'
      ? ['ADRP_GITHUB_SECRET', 'ADRP_WEBHOOK_SECRET']
      : ['ADRP_LEMONSQUEEZY_SECRET', 'ADRP_WEBHOOK_SECRET'])
  if (!secret) return null // no configurado
  let sig = signatureHeader(headers, provider)
  if (!sig) return false
  if (provider === 'github') sig = String(sig).replace(/^sha256[=-]?/i, '')
  const expected = await hmacSha256Hex(rawBody, secret)
  return timingSafeEqualText(String(sig).trim(), expected)
}

async function sendResendEmail(env, { to, license }) {
  const res = await globalThis.fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.ADRP_RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: env.ADRP_RESEND_FROM,
      to,
      subject: 'Your repoDocs ADR Premium license',
      text: `Gracias por tu compra de repoDocs ADR Premium.\n\nTu licencia (token) es:\n\n${license}\n\nPegala en la app (botón 🔑 en la vista Decisions) y quedará activa para siempre en esa instalación (guardada en localStorage como pb:license).\n\n— repoDocs`,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`resend ${res.status}: ${errText.slice(0, 200)}`)
  }
  return res
}

export async function handleWebhook({ rawBody, headers = {}, env = {} }) {
  const raw = typeof rawBody === 'string' ? rawBody : String(rawBody ?? '')

  const ghEvent = headers['x-github-event'] ?? headers['X-GitHub-Event']
  if (ghEvent === 'ping') {
    return { status: 200, json: { ok: true, ignored: 'github:ping' } }
  }

  const classified = classify(raw)
  if (!classified) {
    return { status: 400, json: { ok: false, error: 'unrecognized-payload' } }
  }
  const { provider, order, payload: body } = classified

  const sigRes = await verifySignature({ rawBody: raw, headers, provider, env })
  if (sigRes === null) {
    return { status: 500, json: { ok: false, error: 'webhook-secret-not-configured' } }
  }
  if (sigRes === false) {
    return { status: 401, json: { ok: false, error: 'bad-signature' } }
  }

  if (order.refunded) {
    return { status: 200, json: { ok: true, ignored: 'refunded' } }
  }

  if (provider === 'lemonsqueezy' && body?.meta?.event_name !== 'order_created') {
    return { status: 200, json: { ok: true, ignored: `event:${body.meta.event_name}` } }
  }
  if (provider === 'github' && body?.action !== 'created') {
    return { status: 200, json: { ok: true, ignored: `github:${body.action}` } }
  }

  if (provider === 'github') {
    const tiers = (env.ADRP_GITHUB_TIER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (tiers.length > 0 && !tiers.includes(String(order.product_id))) {
      return { status: 200, json: { ok: false, ignored: 'github-tier-not-matching', tier: order.product_id } }
    }
  } else {
    const allow = (env.ADRP_PRODUCT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (allow.length > 0 && !allow.includes(String(order.product_id))) {
      return { status: 200, json: { ok: false, ignored: 'product-not-matching', product_id: order.product_id } }
    }
  }

  if (order.test_mode && env.ADRP_ACCEPT_TEST !== '1') {
    return { status: 200, json: { ok: false, ignored: 'test-mode', test_mode: true } }
  }

  const priv = pick(env, ['ADRP_PRIVATE_KEY_HEX'])
  if (!priv) {
    return { status: 500, json: { ok: false, error: 'private-key-not-configured' } }
  }

  if (!order.email) {
    return { status: 400, json: { ok: false, error: 'buyer-email-missing' } }
  }

  const seats = Number(env.ADRP_SEATS ?? 1)
  const payload = {
    product: LICENSE_PRODUCT_ID,
    seats: Number.isFinite(seats) && seats >= 1 ? seats : 1,
    issued: new Date().toISOString().slice(0, 10),
    email: order.email,
  }
  const license = await signEd25519(payload, priv)

  let delivered = false
  let emailError = null
  if (env.ADRP_RESEND_KEY && env.ADRP_RESEND_FROM) {
    try {
      await sendResendEmail(env, { to: order.email, license })
      delivered = true
    } catch (e) {
      emailError = String(e?.message ?? e)
    }
  }

  return {
    status: 200,
    json: {
      ok: true,
      provider,
      order_id: order.order_id,
      email: order.email,
      seats: payload.seats,
      issued: payload.issued,
      delivered,
      email_error: emailError,
      license,
    },
  }
}

// útil para tests: parsear el campo email de un token emitido por el webhook
export function payloadEmail(token) {
  try {
    const dot = token.indexOf('.')
    if (dot === -1) return null
    const text = new TextDecoder().decode(b64urlDecode(token.slice(0, dot)))
    return JSON.parse(text).email ?? null
  } catch {
    return null
  }
}