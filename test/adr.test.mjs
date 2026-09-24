import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const EXAMPLES = join(REPO, 'examples')

// Configura la raíz de proyectos ANTES de importar sync-adr (cfg se resuelve al importar).
process.env.MDBOARD_ROOT = EXAMPLES

const { normAdrRef, parseAdrFile, detectStatusHeuristic, collectAdrs, writeAdrs } = await import('../scripts/sync-adr.mjs')
const { loadConfig } = await import('../scripts/config.mjs')
const ADR_STATUS = loadConfig().adr.status

test('normAdrRef normaliza refs a id canónico', () => {
  assert.equal(normAdrRef('0007-algo'), '7')
  assert.equal(normAdrRef(2), '2')
  assert.equal(normAdrRef('0014'), '14')
  assert.equal(normAdrRef(''), '')
})

test('parseAdrFile extrae id, título y status de front-matter', () => {
  const rec = parseAdrFile(
    join(EXAMPLES, 'docsboard-demo/docs/adr/0003-frontmatter-first-status.md'),
    'docsboard-demo',
    ADR_STATUS
  )
  assert.equal(rec.id, '0003')
  assert.equal(rec.status, 'accepted')
  assert.equal(rec.date, '2026-02-02')
  assert.deepEqual(rec.deciders, ['sanchiro'])
  const headings = rec.sections.map((s) => s.heading)
  assert.ok(headings.includes('Context'))
  assert.ok(headings.includes('Decision'))
  assert.ok(headings.includes('Consequences'))
  assert.ok(rec.intro.includes('status: accepted'))
  assert.ok(rec.raw.length > 0)
})

test('detectStatusHeuristic resuelve status por texto plano', () => {
  const list = [
    { key: 'proposed', label: 'Proposed' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'rejected', label: 'Rejected' },
  ]
  assert.equal(detectStatusHeuristic('Status: rejected\n# Foo', list), 'rejected')
  assert.equal(detectStatusHeuristic('## Decision\nWe accepted this change', list), 'accepted')
})

test('collectAdrs escanea los ADRs de examples y resuelve relaciones', () => {
  const adrs = collectAdrs()
  const demo = adrs.filter((a) => a.project === 'docsboard-demo')
  assert.equal(demo.length, 6)
  const byId = Object.fromEntries(demo.map((a) => [a.id, a]))
  assert.equal(byId['0003'].relations[0].targetId, '0002')
  assert.equal(byId['0005'].relations[0].type, 'supersedes')
  assert.equal(byId['0006'].status, 'deprecated')
  for (const a of demo) assert.deepEqual(a.broken, [], `${a.id} no debería tener refs rotas`)
})

test('writeAdrs regenera el módulo sin errores', () => {
  const adrs = collectAdrs()
  writeAdrs(adrs)
  assert.ok(adrs.length > 0)
})