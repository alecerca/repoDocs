import { test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import {
  handleWebhook,
  payloadEmail,
} from '../server/webhook-core.mjs'
import {
  bytesToHex,
  derivePublicKeyHex,
  hmacSha256Hex,
  verifyEd25519,
} from '../server/sign.mjs'

function randomPrivHex() {
  return bytesToHex(webcrypto.getRandomValues(new Uint8Array(32)))
}

function gumroadSale(over = {}) {
  return JSON.stringify({
    sale: {
      id: 'abc-purchase-1',
      product_id: 'repodocs-adr-premium',
      email: 'buyer@example.com',
      full_name: 'Jane Doe',
      refunded: false,
      ...over,
    },
  })
}

function lemonOrder(over = {}) {
  return JSON.stringify({
    meta: { event_name: 'order_created' },
    data: {
      id: 'o-42',
      type: 'orders',
      attributes: {
        user_email: 'buyer@ls.com',
        user_name: 'John Doe',
        status: 'paid',
        first_order_item: { product_id: 42, test_mode: false },
        ...over,
      },
    },
  })
}

const SECRET = 'test-webhook-secret'
const PRODUCTS = 'repodocs-adr-premium,42'

async function envWithKeys(extra = {}) {
  const priv = randomPrivHex()
  return {
    priv,
    pub: await derivePublicKeyHex(priv),
    env: {
      ADRP_WEBHOOK_SECRET: SECRET,
      ADRP_PRODUCT_IDS: PRODUCTS,
      ADRP_PRIVATE_KEY_HEX: priv,
      ...extra,
    },
  }
}

test('gumroad sale → issues a token that verifies against the public key', async () => {
  const { pub, env } = await envWithKeys()
  const rawBody = gumroadSale()
  const sig = await hmacSha256Hex(rawBody, SECRET)
  const out = await handleWebhook({
    rawBody,
    headers: { 'x-gumroad-signature': sig, 'content-type': 'application/json' },
    env,
  })
  assert.equal(out.status, 200)
  assert.equal(out.json.ok, true)
  assert.equal(out.json.provider, 'gumroad')
  assert.equal(payloadEmail(out.json.license), 'buyer@example.com')
  assert.equal(await verifyEd25519(out.json.license, pub), true)
})

test('gumroad bad signature → 401', async () => {
  const { env } = await envWithKeys()
  const out = await handleWebhook({
    rawBody: gumroadSale(),
    headers: { 'x-gumroad-signature': 'deadbeef' },
    env,
  })
  assert.equal(out.status, 401)
  assert.equal(out.json.error, 'bad-signature')
})

test('gumroad refunded sale → acknowledged, no license', async () => {
  const { env } = await envWithKeys()
  const rawBody = gumroadSale({ refunded: true })
  const sig = await hmacSha256Hex(rawBody, SECRET)
  const out = await handleWebhook({ rawBody, headers: { 'x-gumroad-signature': sig }, env })
  assert.equal(out.status, 200)
  assert.equal(out.json.ignored, 'refunded')
  assert.equal('license' in out.json, false)
})

test('gumroad test-mode ignored unless ADRP_ACCEPT_TEST=1', async () => {
  const { priv, pub, env } = await envWithKeys()
  const rawBody = gumroadSale({ test: true })
  const sig = await hmacSha256Hex(rawBody, SECRET)
  const out = await handleWebhook({ rawBody, headers: { 'x-gumroad-signature': sig }, env })
  assert.equal(out.json.ignored, 'test-mode')

  const out2 = await handleWebhook({
    rawBody,
    headers: { 'x-gumroad-signature': sig },
    env: { ...env, ADRP_ACCEPT_TEST: '1' },
  })
  assert.equal(out2.json.ok, true)
  assert.equal(await verifyEd25519(out2.json.license, pub), true)
  assert.equal(priv.length > 0, true)
})

test('gumroad product mismatch → ignored', async () => {
  const { env } = await envWithKeys()
  const rawBody = gumroadSale({ product_id: 'some-other-thing' })
  const sig = await hmacSha256Hex(rawBody, SECRET)
  const out = await handleWebhook({ rawBody, headers: { 'x-gumroad-signature': sig }, env })
  assert.equal(out.json.ignored, 'product-not-matching')
})

test('lemon squeezy order_created → issues a valid token', async () => {
  const { pub, env } = await envWithKeys()
  const rawBody = lemonOrder()
  const sig = await hmacSha256Hex(rawBody, SECRET)
  const out = await handleWebhook({
    rawBody,
    headers: { 'x-signature': sig, 'x-event-name': 'order_created' },
    env,
  })
  assert.equal(out.status, 200)
  assert.equal(out.json.provider, 'lemonsqueezy')
  assert.equal(payloadEmail(out.json.license), 'buyer@ls.com')
  assert.equal(await verifyEd25519(out.json.license, pub), true)
})

test('lemon squeezy wrong event → ignored', async () => {
  const { env } = await envWithKeys()
  const rawBody = lemonOrder()
  const raw = rawBody.replace('order_created', 'order_refunded')
  const sig = await hmacSha256Hex(raw, SECRET)
  const out = await handleWebhook({ rawBody: raw, headers: { 'x-signature': sig }, env })
  assert.equal(out.json.ignored, 'event:order_refunded')
})

test('no secret configured → 500', async () => {
  const out = await handleWebhook({ rawBody: gumroadSale(), headers: {}, env: {} })
  assert.equal(out.status, 500)
  assert.equal(out.json.error, 'webhook-secret-not-configured')
})

test('no private key → 500', async () => {
  const rawBody = gumroadSale()
  const sig = await hmacSha256Hex(rawBody, SECRET)
  const out = await handleWebhook({
    rawBody,
    headers: { 'x-gumroad-signature': sig },
    env: { ADRP_WEBHOOK_SECRET: SECRET, ADRP_PRODUCT_IDS: PRODUCTS },
  })
  assert.equal(out.status, 500)
  assert.equal(out.json.error, 'private-key-not-configured')
})

test('issued license round-trips through the CLI formatter', async () => {
  const { pub, env } = await envWithKeys()
  const rawBody = gumroadSale()
  const sig = await hmacSha256Hex(rawBody, SECRET)
  const out = await handleWebhook({ rawBody, headers: { 'x-gumroad-signature': sig }, env })
  assert.equal(out.json.ok, true)
  // el formato base64url msg.sig de sign.mjs es idéntico al de license-tool.mjs
  assert.equal(out.json.license.split('.').length, 2)
  const decoded = await (await import('../server/sign.mjs')).decodePayload(out.json.license)
  assert.equal(decoded.product, 'repodocs-adr-premium')
  assert.equal(decoded.seats, 1)
})