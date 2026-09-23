import type { CanvasLayout } from './registry'

export type CompactCardLayout = [x: number, y: number, w: number, collapsed: number]

export type CompactTransform = [x: number, y: number, scale: number]

export interface CanvasSharePayload {
  v: number
  p: string
  d: string
  l: Record<string, CompactCardLayout>
  t?: CompactTransform
}

export interface DecodedCanvasShare {
  version: number
  project: string
  doc: string
  positions: Record<string, CanvasLayout>
  transform?: {
    x: number
    y: number
    scale: number
  }
}

/**
 * Encodes a UTF-8 string into a URL-safe Base64 string.
 *
 * @param str The raw input string to encode.
 * @returns A base64url encoded representation with padding removed.
 */
export function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decodes a URL-safe Base64 string back to its original UTF-8 string.
 *
 * @param base64url The URL-safe Base64 encoded string.
 * @returns The decoded UTF-8 string.
 */
export function fromBase64Url(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Serializes the canvas layout and camera position into a compact share payload.
 *
 * @param project The target project identifier.
 * @param doc The document file name.
 * @param positions The map of section identifiers to their canvas layouts.
 * @param transform Optional camera viewport coordinates and scale factor.
 * @returns A structured, compact payload ready for encoding.
 */
export function serializeCanvasLayout(
  project: string,
  doc: string,
  positions: Record<string, CanvasLayout>,
  transform?: { x: number; y: number; scale: number }
): CanvasSharePayload {
  const compactLayouts: Record<string, CompactCardLayout> = {}
  for (const [id, pos] of Object.entries(positions)) {
    compactLayouts[id] = [
      Math.round(pos.x),
      Math.round(pos.y),
      Math.round(pos.w),
      pos.collapsed ? 1 : 0,
    ]
  }

  const payload: CanvasSharePayload = {
    v: 1,
    p: project,
    d: doc,
    l: compactLayouts,
  }

  if (transform) {
    payload.t = [
      Math.round(transform.x),
      Math.round(transform.y),
      Number(transform.scale.toFixed(2)),
    ]
  }

  return payload
}

/**
 * Encodes a canvas share payload into a compact URL-safe string.
 *
 * @param payload The canvas share payload.
 * @returns The URL-safe base64 string.
 */
export function encodeSharePayload(payload: CanvasSharePayload): string {
  const json = JSON.stringify(payload)
  return toBase64Url(json)
}

/**
 * Decodes and validates a URL-safe string into a typed canvas share structure.
 *
 * @param encoded The base64url encoded layout string.
 * @returns The decoded canvas layout structure or null if validation fails.
 */
export function decodeSharePayload(encoded: string): DecodedCanvasShare | null {
  try {
    const rawJson = fromBase64Url(encoded.trim())
    const parsed = JSON.parse(rawJson) as Partial<CanvasSharePayload>

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    if (typeof parsed.p !== 'string' || !parsed.p) {
      return null
    }

    if (typeof parsed.d !== 'string' || !parsed.d) {
      return null
    }

    if (!parsed.l || typeof parsed.l !== 'object') {
      return null
    }

    const positions: Record<string, CanvasLayout> = {}
    for (const [id, tuple] of Object.entries(parsed.l)) {
      if (Array.isArray(tuple) && tuple.length >= 2) {
        const x = Number(tuple[0])
        const y = Number(tuple[1])
        const w = Number(tuple[2] ?? 380)
        const collapsed = Boolean(tuple[3])
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w)) {
          positions[id] = { x, y, w, collapsed }
        }
      }
    }

    let transform: DecodedCanvasShare['transform'] | undefined
    if (Array.isArray(parsed.t) && parsed.t.length >= 3) {
      const tx = Number(parsed.t[0])
      const ty = Number(parsed.t[1])
      const scale = Number(parsed.t[2])
      if (Number.isFinite(tx) && Number.isFinite(ty) && Number.isFinite(scale) && scale > 0) {
        transform = { x: tx, y: ty, scale }
      }
    }

    return {
      version: typeof parsed.v === 'number' ? parsed.v : 1,
      project: parsed.p,
      doc: parsed.d,
      positions,
      transform,
    }
  } catch {
    return null
  }
}

/**
 * Builds a complete shareable web URL for the given canvas layout payload.
 *
 * @param payload The canvas share payload.
 * @param baseUrl Optional base URL override; defaults to current window location.
 * @returns The fully qualified shareable link URL.
 */
export function buildShareUrl(payload: CanvasSharePayload, baseUrl?: string): string {
  const encoded = encodeSharePayload(payload)
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/')
  const url = new URL(base)
  url.searchParams.set('layout', encoded)
  url.hash = ''
  return url.toString()
}

/**
 * Extracts and decodes a canvas share payload from search parameters or URL hash.
 *
 * @param search The query string portion of a URL.
 * @param hash Optional hash portion of a URL.
 * @returns The decoded canvas layout structure or null if not present or invalid.
 */
export function parseShareUrl(search: string, hash?: string): DecodedCanvasShare | null {
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const param = searchParams.get('layout')
  if (param) {
    return decodeSharePayload(param)
  }

  if (hash) {
    const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
    const hashParams = new URLSearchParams(rawHash)
    const hashParam = hashParams.get('layout')
    if (hashParam) {
      return decodeSharePayload(hashParam)
    }
  }

  return null
}
