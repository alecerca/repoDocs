import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeToken,
  isLicenseValid,
  encodeToken,
  LICENSE_PRODUCT_ID,
  publicKeyBytes,
} from '../src/lib/license.ts'
import { issueToken, verifyToken } from '../scripts/license-tool.mjs'
import * as ed from '@noble/ed25519'

const REAL_TOKEN =
  'eyJwcm9kdWN0IjoicmVwb2RvY3MtYWRyLXByZW1pdW0iLCJzZWF0cyI6MSwiaXNzdWVkIjoiMjAyNi0wOS0yNCJ9.ZaCNnlrgRri0s_JhFZrgjogmr0CxELwoOJe6gb6VZyAnqjKSjKmLSQpVMI-9lRlrvBpPJPn7GQaKJDEEZ9MLDA'

const PAYLOAD = { product: LICENSE_PRODUCT_ID, seats: 1, issued: '2026-09-24' }

test('decodeToken parses the real bundle payload', () => {
  const { payload, msg, sig } = decodeToken(REAL_TOKEN)
  assert.deepEqual(payload, PAYLOAD)
  assert.ok(msg && msg.length > 0)
  assert.ok(sig && sig.length === 64)
})

test('decodeToken rejects malformed input without throwing', () => {
  assert.deepEqual(decodeToken(null), { payload: null, msg: null, sig: null })
  assert.deepEqual(decodeToken(''), { payload: null, msg: null, sig: null })
  assert.deepEqual(decodeToken('garbage'), { payload: null, msg: null, sig: null })
  assert.deepEqual(decodeToken('a.b',), { payload: null, msg: null, sig: null })
  assert.deepEqual(decodeToken('not base64@@@.%%%'), { payload: null, msg: null, sig: null })
})

test('the embedded real token verifies against the embedded public key', async () => {
  assert.equal(await isLicenseValid(REAL_TOKEN), true)
})

test('tampering the payload invalidates the token', async () => {
  const { sig } = decodeToken(REAL_TOKEN)
  const tampered = encodeToken({ product: 'other-product', seats: 1, issued: '2026-09-24' }, sig)
  assert.equal(await isLicenseValid(tampered), false)
})

test('a token signed by a different (ephemeral) key is rejected', async () => {
  const priv = ed.utils.randomPrivateKey()
  const unsigned = await issueToken(PAYLOAD, priv)
  assert.equal(await isLicenseValid(unsigned), false)
})

test('empty / null / garbage tokens are invalid', async () => {
  assert.equal(await isLicenseValid(null), false)
  assert.equal(await isLicenseValid(''), false)
  assert.equal(await isLicenseValid('not a token at all'), false)
})

test('publicKeyBytes() matches a 32-byte Ed25519 public key', () => {
  const pub = publicKeyBytes()
  assert.equal(pub.length, 32)
  assert.equal(pub[0], 0x4f) // primer byte de la hex embebida 4fdb…
})

test('tool round-trip: issue → verify (ephemeral keypair)', async () => {
  const priv = ed.utils.randomPrivateKey()
  const { pointBytes } = await ed.utils.getExtendedPublicKeyAsync(priv)
  const pubHex = Buffer.from(pointBytes).toString('hex')
  const token = await issueToken(PAYLOAD, priv)
  assert.equal(await verifyToken(token, pubHex), true)
  assert.equal(await verifyToken(`${token}x`, pubHex), false)
  assert.equal(await verifyToken('garbage', pubHex), false)
})