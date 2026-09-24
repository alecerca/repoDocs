#!/usr/bin/env node
/**
 * license-tool.mjs — CLI para la licencia ADR Premium (Ed25519, spec §6.4).
 *
 * Espejo exacto de lo que hará el webhook serverless de Gumroad/Lemon Squeezy:
 * firma un payload con la clave PRIVADA (que NUNCA vive en el repo). El bundle
 * solo embebe la clave pública (src/lib/license.ts → PUBLIC_KEY) y verifica sin red.
 *
 * Uso:
 *   node scripts/license-tool.mjs generate --out <privada.key>
 *   node scripts/license-tool.mjs issue '<payload-json>' <privada.key>
 *   node scripts/license-tool.mjs verify '<token>' <public-hex>
 *
 * Payload ejemplo: {"product":"repodocs-adr-premium","seats":1,"issued":"2026-09-24"}
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ed from '@noble/ed25519'

const enc = new TextEncoder()

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64url')
}
function unb64url(s) {
  return new Uint8Array(Buffer.from(s, 'base64url'))
}

export function issueToken(payload, privateKeyHexOrBytes) {
  const priv = typeof privateKeyHexOrBytes === 'string'
    ? new Uint8Array(Buffer.from(privateKeyHexOrBytes, 'hex'))
    : privateKeyHexOrBytes
  const msg = enc.encode(typeof payload === 'string' ? payload : JSON.stringify(payload))
  return ed.signAsync(msg, priv).then((sig) => `${b64url(msg)}.${b64url(sig)}`)
}

export async function verifyToken(token, publicKeyHexOrBytes) {
  const [m, s] = String(token ?? '').trim().split('.')
  if (!m || !s) return false
  let pub
  try {
    pub = typeof publicKeyHexOrBytes === 'string'
      ? new Uint8Array(Buffer.from(publicKeyHexOrBytes, 'hex'))
      : publicKeyHexOrBytes
  } catch {
    return false
  }
  const msg = unb64url(m)
  const sig = unb64url(s)
  if (sig.length !== 64 || pub.length !== 32) return false
  return ed.verifyAsync(sig, msg, pub)
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2)
  if (cmd === 'generate') {
    const priv = ed.utils.randomPrivateKey()
    const epk = await ed.utils.getExtendedPublicKeyAsync(priv)
    const pub = epk.pointBytes
    const out = process.argv[process.argv.indexOf('--out') + 1]
    if (out) writeFileSync(out, `# ADR Premium — private key — NO COMMITEEAR\n${Buffer.from(priv).toString('hex')}\n`)
    else process.stdout.write(Buffer.from(priv).toString('hex')) // sin '\n' para evitar capturas accidentales
    console.log('\npublic-key (va en src/lib/license.ts -> PUBLIC_KEY):')
    console.log(Buffer.from(pub).toString('hex'))
    return
  }
  if (cmd === 'issue') {
    const token = await issueToken(JSON.parse(a), readFileSync(b, 'utf8').trim().split('\n').pop())
    console.log(token)
    return
  }
  if (cmd === 'verify') {
    const flag = (name) => {
      const i = process.argv.indexOf(name)
      return i === -1 ? undefined : process.argv[i + 1]
    }
    const pub = flag('--pub') ?? a
    const token = flag('--token') ?? a
    const ok = await verifyToken(token, pub)
    console.log(ok ? 'ok: firma válida' : 'fail: firma inválida')
    process.exitCode = ok ? 0 : 1
    return
  }
  console.error(`uso: ${process.argv[1]} generate [--out priv.key] | issue '<json>' priv.key | verify <token> [--pub hex]`)
  process.exitCode = 2
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}