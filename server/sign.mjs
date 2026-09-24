/**
 * sign.mjs — firma de licencias ADR Premium (Ed25519).
 *
 * Módulo "puro" que comparte el webhook serverless (Vercel / Cloudflare
 * Workers) y el CLI `scripts/license-tool.mjs` un único formato de token:
 *   base64url(JSON payload) . base64url(firma ed25519 de 64 bytes)
 *
 * Sin dependencias de node: usa APIs globales (WebCrypto, TextEncoder, btoa)
 * para correr bien en Node ≥ 18, browsers, edge runtimes (no Buffer, no fs).
 */
import * as ed from '@noble/ed25519'

export const PRODUCT_ID = 'repodocs-adr-premium'

const enc = new TextEncoder()
const dec = new TextDecoder()

export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function hexToBytes(hex) {
  const s = hex.replace(/\s/g, '')
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function b64urlEncode(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function signEd25519(payload, privateKeyHex) {
  const priv = hexToBytes(privateKeyHex)
  const bytes = enc.encode(typeof payload === 'string' ? payload : JSON.stringify(payload))
  const sig = await ed.signAsync(bytes, priv)
  return `${b64urlEncode(bytes)}.${b64urlEncode(sig)}`
}

export async function verifyEd25519(token, publicKeyHex) {
  try {
    const dot = token.indexOf('.')
    if (dot === -1) return false
    const msg = b64urlDecode(token.slice(0, dot))
    const sig = b64urlDecode(token.slice(dot + 1))
    if (sig.length !== 64) return false
    return await ed.verifyAsync(sig, msg, hexToBytes(publicKeyHex))
  } catch {
    return false
  }
}

export async function derivePublicKeyHex(privateKeyHex) {
  const epk = await ed.utils.getExtendedPublicKeyAsync(hexToBytes(privateKeyHex))
  return bytesToHex(epk.pointBytes)
}

export async function hmacSha256Hex(text, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text))
  return bytesToHex(new Uint8Array(sig))
}

export function timingSafeEqualText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function decodePayload(token) {
  try {
    const dot = token.indexOf('.')
    if (dot === -1) return null
    return JSON.parse(dec.decode(b64urlDecode(token.slice(0, dot))))
  } catch {
    return null
  }
}