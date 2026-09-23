import test from 'node:test'
import assert from 'node:assert/strict'
import { PluginManager, loadPlugins } from '../scripts/plugins.mjs'
import frontmatterPlugin, { parseYaml, serializeYaml } from '../scripts/plugins/frontmatter.mjs'
import customTablesPlugin from '../scripts/plugins/custom-tables.mjs'
import dialectsPlugin, { countDialectStatusMarkers } from '../scripts/plugins/dialects.mjs'
import { assembleDoc, rebuildSummaryText } from '../scripts/emitter.mjs'

test('PluginManager prioritizes plugins correctly', () => {
  const pLow = { name: 'low', priority: 10 }
  const pHigh = { name: 'high', priority: 100 }
  const pMid = { name: 'mid', priority: 50 }

  const manager = new PluginManager([pLow, pHigh, pMid])
  assert.deepEqual(
    manager.plugins.map((p) => p.name),
    ['high', 'mid', 'low']
  )
})

test('PluginManager filters by project correctly', () => {
  const pAll = { name: 'all' }
  const pSpecific = { name: 'specific', projects: ['alpha', 'beta'] }
  const pRegex = { name: 'regex', projects: /^gamma/ }

  const manager = new PluginManager([pAll, pSpecific, pRegex])

  const alphaPlugins = manager.getPluginsForContext({ projectName: 'alpha' })
  assert.equal(alphaPlugins.length, 2)
  assert.ok(alphaPlugins.some((p) => p.name === 'all'))
  assert.ok(alphaPlugins.some((p) => p.name === 'specific'))

  const gammaPlugins = manager.getPluginsForContext({ projectName: 'gamma-core' })
  assert.equal(gammaPlugins.length, 2)
  assert.ok(gammaPlugins.some((p) => p.name === 'all'))
  assert.ok(gammaPlugins.some((p) => p.name === 'regex'))

  const deltaPlugins = manager.getPluginsForContext({ projectName: 'delta' })
  assert.equal(deltaPlugins.length, 1)
  assert.equal(deltaPlugins[0].name, 'all')
})

test('PluginManager safely isolates hook errors', () => {
  const pFaulty = {
    name: 'faulty',
    beforeParse() {
      throw new Error('Explosion')
    },
  }
  const manager = new PluginManager([pFaulty])
  const result = manager.runBeforeParse({ raw: '# Title' })
  assert.equal(result.raw, '# Title')
})

test('loadPlugins discovers and imports default plugins', async () => {
  const manager = await loadPlugins({})
  assert.ok(manager.plugins.length >= 3)
  assert.ok(manager.plugins.some((p) => p.name === 'frontmatter'))
  assert.ok(manager.plugins.some((p) => p.name === 'custom-tables'))
  assert.ok(manager.plugins.some((p) => p.name === 'dialects'))
})

test('frontmatter YAML parsing and serialization', () => {
  const yamlContent = `
title: Architecture Guide
version: 2
active: true
tags:
  - backend
  - database
`
  const parsed = parseYaml(yamlContent)
  assert.equal(parsed.title, 'Architecture Guide')
  assert.equal(parsed.version, 2)
  assert.equal(parsed.active, true)
  assert.deepEqual(parsed.tags, ['backend', 'database'])

  const serialized = serializeYaml(parsed)
  assert.ok(serialized.includes('title: Architecture Guide'))
  assert.ok(serialized.includes('version: 2'))
  assert.ok(serialized.includes('active: true'))
  assert.ok(serialized.includes('- backend'))
})

test('frontmatter plugin beforeParse, parseTitle, afterParse, and afterEmit', () => {
  const rawWithFm = `---
title: Custom Title from FM
subtitle: Custom Subtitle from FM
author: Antigravity
---
# Ignored Header
Some introductory prose.

## Section 1
Content here.
`
  const beforeRes = frontmatterPlugin.beforeParse({ raw: rawWithFm })
  assert.ok(beforeRes)
  assert.equal(beforeRes.frontmatter.title, 'Custom Title from FM')
  assert.ok(!beforeRes.raw.startsWith('---'))
  assert.ok(beforeRes.raw.includes('# Ignored Header'))

  const titleRes = frontmatterPlugin.parseTitle({ extra: beforeRes })
  assert.equal(titleRes.title, 'Custom Title from FM')
  assert.equal(titleRes.subtitle, 'Custom Subtitle from FM')

  const doc = {
    title: titleRes.title,
    sections: [],
    raw: rawWithFm,
    intro: 'Some introductory prose.',
  }
  const updatedDoc = frontmatterPlugin.afterParse({ doc, extra: beforeRes })
  assert.equal(updatedDoc.frontmatter.author, 'Antigravity')

  const emitted = frontmatterPlugin.afterEmit({
    markdown: '# Emitted Document\nContent.',
    doc: updatedDoc,
  })
  assert.ok(emitted.startsWith('---'))
  assert.ok(emitted.includes('title: Custom Title from FM'))
  assert.ok(emitted.includes('# Emitted Document'))
})

test('custom-tables plugin parses non-standard table headers', () => {
  const markdown = `
# Project Plan

| Task | Assignee | Status |
| --- | --- | --- |
| 1. API | Alice | In Progress |
| 2. DB | Bob | Done |
`
  const lines = markdown.trim().split('\n')
  const result = customTablesPlugin.parseSummaryTable({ lines })
  assert.ok(result)
  assert.equal(result.entries.length, 2)
  assert.equal(result.entries[0].tema, '1. API')
  assert.equal(result.entries[0].estado, 'In Progress')
  assert.equal(result.entries[1].tema, '2. DB')
  assert.equal(result.entries[1].estado, 'Done')

  const emitted = customTablesPlugin.emitSummaryTable({ summary: result })
  assert.ok(emitted.includes('| Task | Assignee | Status |'))
  assert.ok(emitted.includes('| 1. API | In Progress |'))
})

test('dialects plugin detects checklist and directive status indicators', () => {
  const textChecklist = `
## Tasks
- [x] Complete test suite
- [x] Integrate plugin system
- [ ] Add deployment script
`
  const counts = countDialectStatusMarkers(textChecklist)
  assert.equal(counts.done, 2)
  assert.equal(counts.pending, 1)

  const detected = dialectsPlugin.detectStatus({ text: textChecklist })
  assert.ok(detected)
  assert.equal(detected[0].key, 'done')

  const directiveText = `
## Module
@status(progress)
Working on feature.
`
  const detectedDirective = dialectsPlugin.detectStatus({ text: directiveText })
  assert.ok(detectedDirective)
  assert.equal(detectedDirective[0].key, 'progress')
})

test('assembleDoc reconstructs markdown with edits and preserves frontmatter', () => {
  const rawDoc = `---
title: Test Document
status: done
---
# Test Document

Intro prose here.

## Section Alpha
Initial alpha text.
`
  const manager = new PluginManager([frontmatterPlugin])
  const context = { raw: rawDoc, extra: {} }
  const beforeRes = manager.runBeforeParse(context)

  const doc = {
    file: 'test.md',
    title: 'Test Document',
    raw: rawDoc,
    intro: 'Intro prose here.',
    introEndLine: 7,
    sections: [
      {
        id: 'section-alpha-0',
        heading: 'Section Alpha',
        level: 2,
        kind: 'section',
        raw: '## Section Alpha\nInitial alpha text.',
        startLine: 9,
        endLine: 10,
        status: 'done',
      },
    ],
    frontmatter: beforeRes.extra.frontmatter,
    _frontmatterRaw: beforeRes.extra._frontmatterRaw,
  }

  const edits = {
    'test::section-alpha-0': '## Section Alpha\nUpdated alpha text through editor.',
  }

  const output = assembleDoc(doc, edits, 'test', { pluginManager: manager })
  assert.ok(output.startsWith('---'))
  assert.ok(output.includes('title: Test Document'))
  assert.ok(output.includes('Updated alpha text through editor.'))
  assert.ok(!output.includes('Initial alpha text.'))
})

test('rebuildSummaryText formats standard summary table correctly', () => {
  const summary = {
    entries: [
      { num: '1', tema: 'Auth', estado: 'done' },
      { num: '2', tema: 'Billing', estado: 'pending' },
    ],
  }
  const config = {
    summary: {
      headers: ['#', 'Tema', 'Estado'],
    },
  }
  const formatted = rebuildSummaryText(summary, config, '## Summary')
  assert.ok(formatted.includes('## Summary'))
  assert.ok(formatted.includes('| # | Tema | Estado |'))
  assert.ok(formatted.includes('| 1 | Auth | done |'))
  assert.ok(formatted.includes('| 2 | Billing | pending |'))
})

test('default parser invariance is preserved when no plugins modify document', () => {
  const emptyManager = new PluginManager([])
  const raw = `# Title
> Subtitle

## Section One ✅
Body of section one.
`
  const context = { raw, filePath: 'test.md', projectName: 'demo', file: 'test.md', extra: {} }
  const beforeRes = emptyManager.runBeforeParse(context)
  assert.equal(beforeRes.raw, raw)

  const titleRes = emptyManager.runParseTitle(context)
  assert.equal(titleRes, null)

  const summaryRes = emptyManager.runParseSummaryTable({ ...context, lines: raw.split('\n') })
  assert.equal(summaryRes, null)

  const statusRes = emptyManager.runDetectStatus({ ...context, text: 'Body of section one.' })
  assert.equal(statusRes, null)

  const sectionsRes = emptyManager.runParseSections({ ...context, lines: raw.split('\n') })
  assert.equal(sectionsRes, null)
})

test('full plugin lifecycle parses frontmatter, custom tables, and status dialects', async () => {
  const manager = await loadPlugins({})
  const markdown = `---
title: Lifecycle Project
subtitle: Comprehensive Plugin Test
version: 1.0.0
---
# Lifecycle Project

> Comprehensive Plugin Test

| Task | Owner | Status |
| --- | --- | --- |
| Architecture | Lead | Done |
| Testing | QA | In Progress |

## Sprint Backlog
- [x] Implemented plugin loader
- [x] Created frontmatter hook
- [ ] Deploy release

## Infrastructure
- [ ] Provision database
`
  const context = {
    raw: markdown,
    filePath: '/tmp/test.md',
    projectName: 'test-project',
    file: 'test.md',
    extra: {},
  }

  const beforeRes = manager.runBeforeParse(context)
  assert.equal(beforeRes.extra.frontmatter.title, 'Lifecycle Project')
  assert.equal(beforeRes.extra.frontmatter.version, '1.0.0')

  const titleRes = manager.runParseTitle({ ...context, extra: beforeRes.extra })
  assert.equal(titleRes.title, 'Lifecycle Project')
  assert.equal(titleRes.subtitle, 'Comprehensive Plugin Test')

  const lines = beforeRes.raw.split('\n')
  const summaryRes = manager.runParseSummaryTable({ ...context, lines })
  assert.ok(summaryRes)
  assert.equal(summaryRes.entries.length, 2)
  assert.equal(summaryRes.entries[0].tema, 'Architecture')
  assert.equal(summaryRes.entries[0].estado, 'Done')

  const sprintText = lines.slice(9, 13).join('\n')
  const statusRes = manager.runDetectStatus({ ...context, text: sprintText })
  assert.ok(statusRes)
  assert.equal(statusRes[0].key, 'done')
})

