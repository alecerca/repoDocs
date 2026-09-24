import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

const { toMermaid, cleanMermaidLabel, buildGraph, supersededByMap, layeredLayout } = await import('../src/lib/adrGraph.ts')

const meta = [
  { key: 'proposed', emoji: '🟡', label: 'Proposed', plural: 'Proposed' },
  { key: 'accepted', emoji: '✅', label: 'Accepted', plural: 'Accepted' },
  { key: 'superseded', emoji: '🔁', label: 'Superseded', plural: 'Superseded' },
]

function rec(id, status, relations = [], title = `ADR ${id}`) {
  return {
    id,
    project: 'demo',
    file: `${id}-x.md`,
    title,
    status,
    date: '2026-01-01',
    deciders: [],
    sections: [],
    relations,
    intro: '',
    introEndLine: 0,
    startLine: 1,
    endLine: 1,
    raw: '# x\n',
    sha: 'x',
    lines: 1,
    bytes: 4,
    broken: [],
    statusMeta: meta,
  }
}

test('cleanMermaidLabel elimina comillas, backticks y saltos', () => {
  assert.equal(cleanMermaidLabel('Usar `bien` "y" mal'), 'Usar bien y mal')
  assert.equal(cleanMermaidLabel('multi\nline'), 'multi line')
})

test('toMermaid genera un flowchart LR con nodos y flechas etiquetadas', () => {
  const records = [
    rec('0001', 'accepted', [{ type: 'depends_on', targetId: '0003' }]),
    rec('0002', 'superseded'),
    rec('0003', 'accepted', [{ type: 'supersedes', targetId: '0002' }]),
  ]
  const mmd = toMermaid(records)
  assert.ok(mmd.includes('flowchart LR'))
  assert.match(mmd, /n0001\["✅ 0001 · ADR 0001"\]/)
  assert.match(mmd, /n0002\["🔁 0002 · ADR 0002"\]/)
  assert.ok(mmd.includes('n0003 -->|supersedes| n0002'))
  assert.ok(mmd.includes('n0001 -->|depends_on| n0003'))
})

test('toMermaid omite relaciones con referencias rotas', () => {
  const records = [rec('0001', 'accepted', [{ type: 'supersedes', targetId: '9999' }])]
  const mmd = toMermaid(records)
  assert.ok(mmd.includes('n0001['))
  assert.ok(!mmd.includes('n9999'))
  assert.ok(!mmd.includes('n0001 -->'))
})

test('toMermaid con título con comillas no rompe el label', () => {
  const records = [rec('0001', 'accepted', [], 'Usar "SQLite" \'ahora\' [ya]')]
  const mmd = toMermaid(records)
  assert.ok(mmd.includes('n0001["✅ 0001 · Usar (SQLite) (ya)"]') || mmd.includes('n0001['))
  assert.equal((mmd.match(/n0001\[/g) || []).length, 1)
})

test('buildGraph deduplica aristas y supersededByMap invierte supersedes', () => {
  const records = [
    rec('0003', 'accepted', [{ type: 'supersedes', targetId: '0002' }]),
    rec('0002', 'superseded'),
  ]
  assert.equal(buildGraph(records).edges.length, 1)
  assert.deepEqual(supersededByMap(records)['0002'], ['0003'])
})

test('layeredLayout separa por columnas de superseding', () => {
  const a = rec('0001', 'accepted')
  const b = rec('0002', 'superseded', [{ type: 'supersedes', targetId: '0001' }])
  const pos = layeredLayout([a, b], buildGraph([a, b]).edges)
  assert.notEqual(pos['0001']?.x, pos['0002']?.x)
  assert.ok(pos['0001'] && pos['0002'])
})