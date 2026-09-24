import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const EXAMPLES = join(REPO, 'examples')

// Configura la raíz de proyectos ANTES de importar sync-adr (cfg se resuelve al importar).
process.env.MDBOARD_ROOT = EXAMPLES

const { normAdrRef, parseAdrFile, detectStatusHeuristic, collectAdrs, writeAdrs, parseAdrFrontmatter } = await import('../scripts/sync-adr.mjs')
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

test('parseAdrFrontmatter soporta YAML · TOML (+++) · JSON (;;;)', () => {
  assert.equal(parseAdrFrontmatter('---\nstatus: proposed\n---\n# x').status, 'proposed')
  const tomlData = parseAdrFrontmatter('+++\nstatus = "accepted"\ndate = 2024-02-02\nsupersedes = ["0003"]\ndeciders = ["sanchiro", "ana"]\n+++\n# x')
  assert.equal(tomlData.status, 'accepted')
  assert.deepEqual(tomlData.supersedes, ['0003'])
  assert.deepEqual(tomlData.deciders, ['sanchiro', 'ana'])
  const jsonData = parseAdrFrontmatter(';;;\n{"status": "rejected", "date": "2024-03-05"}\n;;;\n# x')
  assert.equal(jsonData.status, 'rejected')
  assert.equal(jsonData.date, '2024-03-05')
  assert.deepEqual(parseAdrFrontmatter('no hay front-matter acá'), {})
  assert.deepEqual(parseAdrFrontmatter('+++\nesto-no-es-toml = =\n+++\n# x'), {})
})

function withTmpAdr(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'adr-fm-'))
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, 'utf8')
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('parseAdrFile lee front-matter TOML (status, date, relaciones)', () => {
  withTmpAdr(
    {
      '0012-toml.md':
        '+++\nstatus = "accepted"\ndate = 2024-02-02\ndeciders = ["sanchiro"]\nsupersedes = ["0007"]\n+++\n# Usar TOML\n\n## Context\n\nCtx\n\n## Decision\n\nDec\n',
    },
    (dir) => {
      const rec = parseAdrFile(join(dir, '0012-toml.md'), 'tmp-proj', ADR_STATUS)
      assert.equal(rec.id, '0012')
      assert.equal(rec.status, 'accepted')
      assert.equal(rec.date, '2024-02-02')
      assert.deepEqual(rec.deciders, ['sanchiro'])
      assert.deepEqual(rec.relations, [{ type: 'supersedes', targetId: '7' }])
      assert.ok(rec.sections.some((s) => s.heading === 'Context'))
    }
  )
})

test('parseAdrFile lee front-matter JSON (status, date string, relaciones)', () => {
  withTmpAdr(
    {
      '0013-json.md':
        ';;;\n{"status": "accepted", "date": "2024-03-05", "related_to": ["0002"]}\n;;;\n# Usar JSON\n\n## Context\n\nCtx\n',
    },
    (dir) => {
      const rec = parseAdrFile(join(dir, '0013-json.md'), 'tmp-proj', ADR_STATUS)
      assert.equal(rec.status, 'accepted')
      assert.equal(rec.date, '2024-03-05')
      assert.deepEqual(rec.relations, [{ type: 'related_to', targetId: '2' }])
    }
  )
})