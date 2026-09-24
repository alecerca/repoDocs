import * as ed from '@noble/ed25519'

export const LICENSE_PRODUCT_ID = 'repodocs-adr-premium'
export const ADR_PUBLIC_KEY_HEX =
  '4fdbe7cbc5cd2cbe767f51c82ac7b42f4567505351f1ba692a4c473267410d06'

const LICENSE_STORAGE_KEY = 'pb:license'

export interface LicensePayload {
  product: string
  seats: number
  issued: string
}

export type LicenseState =
  | { status: 'checking' }
  | { status: 'none' }
  | { status: 'valid'; payload: LicensePayload }
  | { status: 'invalid' }

function encodeB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function encodeToken(payload: LicensePayload | string, sig: Uint8Array): string {
  const msg = encodeB64Url(new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload)))
  const sigPart = encodeB64Url(sig)
  return `${msg}.${sigPart}`
}

export interface DecodedToken {
  payload: LicensePayload | null
  msg: Uint8Array | null
  sig: Uint8Array | null
}

export function decodeToken(token: string | null | undefined): DecodedToken {
  if (!token) return { payload: null, msg: null, sig: null }
  const dot = token.indexOf('.')
  const msgPart = dot === -1 ? '' : token.slice(0, dot)
  const sigPart = dot === -1 ? '' : token.slice(dot + 1)
  if (!msgPart || !sigPart) return { payload: null, msg: null, sig: null }
  try {
    const b64 = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/')
    const msgBin = atob(b64(msgPart))
    const sigBin = atob(b64(sigPart))
    const msg = new Uint8Array(msgBin.length)
    for (let i = 0; i < msgBin.length; i++) msg[i] = msgBin.charCodeAt(i)
    const sig = new Uint8Array(sigBin.length)
    for (let i = 0; i < sigBin.length; i++) sig[i] = sigBin.charCodeAt(i)
    const payload = JSON.parse(new TextDecoder().decode(msg)) as LicensePayload
    return { payload, msg, sig }
  } catch {
    return { payload: null, msg: null, sig: null }
  }
}

export function publicKeyBytes(): Uint8Array {
  const hex = ADR_PUBLIC_KEY_HEX.trim()
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export async function isLicenseValid(token: string | null | undefined): Promise<boolean> {
  const { payload, msg, sig } = decodeToken(token)
  if (!payload || !msg || !sig) return false
  if (payload.product !== LICENSE_PRODUCT_ID) return false
  if (!Number.isFinite(Number(payload.seats)) || Number(payload.seats) < 1) return false
  try {
    return await ed.verifyAsync(sig, msg, publicKeyBytes())
  } catch {
    return false
  }
}

export function readLicenseToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(LICENSE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeLicenseToken(token: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, token)
  } catch {
    /* noop */
  }
}

export function clearLicenseToken(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY)
  } catch {
    /* noop */
  }
}