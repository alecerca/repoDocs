import assert from 'node:assert/strict'
import {
  toBase64Url,
  fromBase64Url,
  serializeCanvasLayout,
  encodeSharePayload,
  decodeSharePayload,
  buildShareUrl,
  parseShareUrl,
} from '../src/lib/canvasShare.ts'
import { getCanvasCompositionBounds } from '../src/lib/canvasExport.ts'

/**
 * Validates base64url encoding and decoding fidelity with unicode strings.
 */
function testBase64UrlPrimitives() {
  const original = 'repoDocs / Diseño & Estructura 🚀'
  const encoded = toBase64Url(original)
  assert.equal(encoded.includes('+'), false)
  assert.equal(encoded.includes('/'), false)
  assert.equal(encoded.includes('='), false)

  const decoded = fromBase64Url(encoded)
  assert.equal(decoded, original)
}

/**
 * Validates compact canvas serialization and deserialization roundtrip.
 */
function testSerializationRoundtrip() {
  const project = 'repoDocs'
  const doc = 'README.md'
  const positions = {
    'sec-1': { x: 120, y: 80, w: 420, collapsed: false },
    'sec-2': { x: 580, y: 140, w: 360, collapsed: true },
    'sec-3': { x: -50, y: 300, w: 400, collapsed: false },
  }
  const transform = { x: 26, y: -40, scale: 0.85 }

  const serialized = serializeCanvasLayout(project, doc, positions, transform)
  assert.equal(serialized.v, 1)
  assert.equal(serialized.p, project)
  assert.equal(serialized.d, doc)
  assert.deepEqual(serialized.t, [26, -40, 0.85])
  assert.deepEqual(serialized.l['sec-1'], [120, 80, 420, 0])
  assert.deepEqual(serialized.l['sec-2'], [580, 140, 360, 1])
  assert.deepEqual(serialized.l['sec-3'], [-50, 300, 400, 0])

  const encoded = encodeSharePayload(serialized)
  const deserialized = decodeSharePayload(encoded)
  assert.ok(deserialized !== null)
  assert.equal(deserialized.project, project)
  assert.equal(deserialized.doc, doc)
  assert.deepEqual(deserialized.positions, positions)
  assert.deepEqual(deserialized.transform, transform)
}

/**
 * Validates payload encoding and decoding with high-level API.
 */
function testSharePayloadEncoding() {
  const project = 'SalseoGame'
  const doc = 'RECOMENDACIONES.md'
  const positions = {
    'card-alpha': { x: 100, y: 200, w: 380, collapsed: false },
    'card-beta': { x: 500, y: 200, w: 380, collapsed: true },
  }
  const transform = { x: 0, y: 0, scale: 1 }

  const payload = serializeCanvasLayout(project, doc, positions, transform)
  const encoded = encodeSharePayload(payload)
  assert.equal(typeof encoded, 'string')
  assert.ok(encoded.length > 20)

  const decoded = decodeSharePayload(encoded)
  assert.ok(decoded !== null)
  assert.equal(decoded.project, project)
  assert.equal(decoded.doc, doc)
  assert.deepEqual(decoded.positions, positions)
  assert.deepEqual(decoded.transform, transform)
}

/**
 * Validates error resilience against corrupted or malformed payloads.
 */
function testCorruptedPayloadHandling() {
  assert.equal(decodeSharePayload(''), null)
  assert.equal(decodeSharePayload('not-valid-base64!!!'), null)
  assert.equal(decodeSharePayload(toBase64Url('{"invalid":"json"')), null)
  assert.equal(decodeSharePayload(toBase64Url(JSON.stringify({ v: 2 }))), null)
  assert.equal(decodeSharePayload(toBase64Url(JSON.stringify({ v: 1, p: 'proj' }))), null)
  assert.equal(decodeSharePayload(toBase64Url(JSON.stringify({ v: 1, p: 'proj', d: 'doc', l: 'not-an-object' }))), null)
}

/**
 * Validates URL construction and query/hash extraction.
 */
function testUrlConstructionAndParsing() {
  const project = 'MyProject'
  const doc = 'README.md'
  const positions = {
    intro: { x: 50, y: 50, w: 400, collapsed: false },
  }
  const transform = { x: 10, y: 20, scale: 1.2 }

  const payload = serializeCanvasLayout(project, doc, positions, transform)
  const shareUrl = buildShareUrl(payload, 'https://repodocs.local/app/')

  assert.ok(shareUrl.startsWith('https://repodocs.local/app/?layout='))

  const parsedUrl = new URL(shareUrl)
  const decodedFromSearch = parseShareUrl(parsedUrl.search)
  assert.ok(decodedFromSearch !== null)
  assert.equal(decodedFromSearch.project, project)
  assert.equal(decodedFromSearch.doc, doc)
  assert.deepEqual(decodedFromSearch.positions, positions)
  assert.deepEqual(decodedFromSearch.transform, transform)

  const hashString = `#layout=${parsedUrl.searchParams.get('layout')}`
  const decodedFromHash = parseShareUrl('', hashString)
  assert.ok(decodedFromHash !== null)
  assert.equal(decodedFromHash.project, project)
}

/**
 * Validates composition bounds calculation with synthetic DOM elements.
 */
function testCompositionBoundsCalculation() {
  const cards = [
    { offsetLeft: 100, offsetTop: 50, offsetWidth: 300, offsetHeight: 200 },
    { offsetLeft: 500, offsetTop: 150, offsetWidth: 350, offsetHeight: 400 },
  ]
  const bounds = getCanvasCompositionBounds(cards)

  assert.equal(bounds.minX, 100)
  assert.equal(bounds.minY, 50)
  assert.equal(bounds.maxX, 850)
  assert.equal(bounds.maxY, 550)
  assert.equal(bounds.width, 750)
  assert.equal(bounds.height, 500)
}

testBase64UrlPrimitives()
testSerializationRoundtrip()
testSharePayloadEncoding()
testCorruptedPayloadHandling()
testUrlConstructionAndParsing()
testCompositionBoundsCalculation()

console.log('All canvas share and export unit tests passed.')
