import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyStatusOverrides,
  parseYamlStatus,
  extractFrontmatter,
  resolveDocStatus,
  isStatusCustomized,
  buildStatusPatterns,
  detectStatus,
} from '../scripts/sync-docs.mjs'

const GLOBAL_STATUS = [
  { key: 'done', emoji: '✅', label: 'Done', plural: 'Done', hint: 'done|completad|listo' },
  { key: 'pending', emoji: '📌', label: 'Pending', plural: 'Pending', hint: 'pending|pendiente' },
  { key: 'progress', emoji: '🔶', label: 'In progress', plural: 'In progress', hint: 'progress|en progreso' },
]

describe('applyStatusOverrides', () => {
  test('returns unchanged base when no overrides provided', () => {
    const res = applyStatusOverrides(GLOBAL_STATUS, null)
    assert.deepEqual(res, GLOBAL_STATUS)
  })

  test('applies array-based overrides to existing keys', () => {
    const overrides = [
      { key: 'done', emoji: '🎉', label: 'Completed' },
    ]
    const res = applyStatusOverrides(GLOBAL_STATUS, overrides)
    const done = res.find((s) => s.key === 'done')
    assert.equal(done.emoji, '🎉')
    assert.equal(done.label, 'Completed')
    // Untouched statuses remain intact
    assert.equal(res.find((s) => s.key === 'pending').emoji, '📌')
  })

  test('applies array-based overrides that add new statuses', () => {
    const overrides = [
      { key: 'blocked', emoji: '🚫', label: 'Blocked', plural: 'Blocked' },
    ]
    const res = applyStatusOverrides(GLOBAL_STATUS, overrides)
    assert.equal(res.length, 4)
    const blocked = res.find((s) => s.key === 'blocked')
    assert.equal(blocked.emoji, '🚫')
    assert.equal(blocked.label, 'Blocked')
  })

  test('applies map-based overrides with string emoji values', () => {
    const overrides = {
      done: '🚀',
      pending: '⏳',
    }
    const res = applyStatusOverrides(GLOBAL_STATUS, overrides)
    assert.equal(res.find((s) => s.key === 'done').emoji, '🚀')
    assert.equal(res.find((s) => s.key === 'pending').emoji, '⏳')
    assert.equal(res.find((s) => s.key === 'progress').emoji, '🔶')
  })

  test('applies map-based overrides with object values', () => {
    const overrides = {
      done: { emoji: '🎉', label: 'All Done' },
      archived: { emoji: '📦', label: 'Archived' },
    }
    const res = applyStatusOverrides(GLOBAL_STATUS, overrides)
    const done = res.find((s) => s.key === 'done')
    assert.equal(done.emoji, '🎉')
    assert.equal(done.label, 'All Done')
    const archived = res.find((s) => s.key === 'archived')
    assert.equal(archived.emoji, '📦')
    assert.equal(archived.label, 'Archived')
  })
})

describe('frontmatter parsing', () => {
  test('parseYamlStatus parses nested object status', () => {
    const yaml = `status:
  done:
    emoji: "🎉"
    label: "Finished"
`
    const parsed = parseYamlStatus(yaml)
    assert.deepEqual(parsed, {
      done: { emoji: '🎉', label: 'Finished' },
    })
  })

  test('parses YAML map status', () => {
    const raw = `---
status:
  done: "🎉"
  pending: "⏳"
---
# Document Title
`
    const { frontmatter } = extractFrontmatter(raw)
    assert.deepEqual(frontmatter, { done: '🎉', pending: '⏳' })
  })

  test('parses YAML list status', () => {
    const raw = `---
status:
  - key: done
    emoji: "🎉"
    label: "Shipped"
---
# Content
`
    const { frontmatter } = extractFrontmatter(raw)
    assert.deepEqual(frontmatter, [
      { key: 'done', emoji: '🎉', label: 'Shipped' },
    ])
  })

  test('parses JSON frontmatter', () => {
    const raw = `---
{"status": {"done": "✨"}}
---
# Title
`
    const { frontmatter } = extractFrontmatter(raw)
    assert.deepEqual(frontmatter, { done: '✨' })
  })

  test('returns null frontmatter when not present', () => {
    const raw = `# Just a title\nNo frontmatter here.`
    const { frontmatter } = extractFrontmatter(raw)
    assert.equal(frontmatter, null)
  })
})

describe('resolveDocStatus resolution cascade', () => {
  test('returns global defaults when no overrides exist', () => {
    const res = resolveDocStatus(GLOBAL_STATUS, null, 'AGENTS.md', '# Title\n')
    assert.equal(res.find((s) => s.key === 'done').emoji, '✅')
    assert.equal(isStatusCustomized(GLOBAL_STATUS, res), false)
  })

  test('applies project-level brand status override', () => {
    const brand = {
      name: 'Project A',
      status: { done: '🚀' },
    }
    const res = resolveDocStatus(GLOBAL_STATUS, brand, 'AGENTS.md', '# Title\n')
    assert.equal(res.find((s) => s.key === 'done').emoji, '🚀')
    assert.equal(isStatusCustomized(GLOBAL_STATUS, res), true)
  })

  test('applies doc-level override in brand.docs', () => {
    const brand = {
      name: 'Project B',
      status: { done: '🚀' },
      docs: {
        'SPECIAL.md': {
          status: { done: '🌟' },
        },
      },
    }
    // SPECIAL.md gets doc-level override
    const special = resolveDocStatus(GLOBAL_STATUS, brand, 'SPECIAL.md', '# Special\n')
    assert.equal(special.find((s) => s.key === 'done').emoji, '🌟')

    // Other doc falls back to brand status
    const regular = resolveDocStatus(GLOBAL_STATUS, brand, 'README.md', '# Readme\n')
    assert.equal(regular.find((s) => s.key === 'done').emoji, '🚀')
  })

  test('applies doc-level override in brand.statusByDoc', () => {
    const brand = {
      name: 'Project C',
      statusByDoc: {
        'NOTES.md': { pending: '💤' },
      },
    }
    const res = resolveDocStatus(GLOBAL_STATUS, brand, 'NOTES.md', '# Notes\n')
    assert.equal(res.find((s) => s.key === 'pending').emoji, '💤')
    assert.equal(res.find((s) => s.key === 'done').emoji, '✅')
  })

  test('frontmatter takes precedence over brand and global overrides', () => {
    const brand = {
      name: 'Project D',
      status: { done: '🚀' },
      docs: {
        'AGENTS.md': { status: { done: '🌟' } },
      },
    }
    const rawWithFrontmatter = `---
status:
  done: "🎉"
---
# Agents doc
`
    const res = resolveDocStatus(GLOBAL_STATUS, brand, 'AGENTS.md', rawWithFrontmatter)
    assert.equal(res.find((s) => s.key === 'done').emoji, '🎉')
  })
})

describe('detectStatus with custom emojis', () => {
  test('detects custom status emoji in markdown section', () => {
    const customList = applyStatusOverrides(GLOBAL_STATUS, { done: '🎉' })
    const patterns = buildStatusPatterns(customList)
    const matches = detectStatus('## Features — 🎉 Shipped\nAll tasks done.', patterns)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].key, 'done')
  })

  test('ignores old emoji when overridden', () => {
    const customList = [
      { key: 'done', emoji: '🎉', label: 'Done', plural: 'Done', hint: 'completed' },
    ]
    const patterns = buildStatusPatterns(customList)
    const matches = detectStatus('## Section with ✅ only', patterns)
    assert.equal(matches.length, 0)
  })
})
