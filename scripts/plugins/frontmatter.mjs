/**
 * Parses simple YAML string into an object.
 *
 * @param {string} yamlStr
 * @returns {Record<string, unknown>}
 */
export function parseYaml(yamlStr) {
  const result = {}
  const lines = yamlStr.split('\n')
  let currentKey = null
  let currentArray = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (trimmed.startsWith('- ') && currentKey && currentArray) {
      const val = trimmed.slice(2).trim()
      currentArray.push(parseYamlValue(val))
      continue
    }

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim()
    const rawVal = line.slice(colonIdx + 1).trim()

    if (!key) continue

    if (rawVal === '') {
      currentKey = key
      currentArray = []
      result[key] = currentArray
      continue
    }

    currentKey = null
    currentArray = null
    result[key] = parseYamlValue(rawVal)
  }

  return result
}

/**
 * Parses a primitive YAML value string into its JavaScript representation.
 *
 * @param {string} val
 * @returns {unknown}
 */
export function parseYamlValue(val) {
  if (val === 'true') return true
  if (val === 'false') return false
  if (val === 'null') return null
  if (/^-?\d+$/.test(val)) return parseInt(val, 10)
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val)

  if (val.startsWith('[') && val.endsWith(']')) {
    const inner = val.slice(1, -1).trim()
    if (!inner) return []
    return inner.split(',').map((item) => parseYamlValue(item.trim()))
  }

  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1)
  }

  return val
}

/**
 * Serializes an object to a YAML frontmatter block.
 *
 * @param {Record<string, unknown>} obj
 * @returns {string}
 */
export function serializeYaml(obj) {
  if (!obj || typeof obj !== 'object') return ''
  const lines = ['---']
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) continue
    if (value === undefined || value === null) continue

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}:`)
        for (const item of value) {
          lines.push(`  - ${formatYamlValue(item)}`)
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}:`)
      for (const [subKey, subVal] of Object.entries(value)) {
        lines.push(`  ${subKey}: ${formatYamlValue(subVal)}`)
      }
    } else {
      lines.push(`${key}: ${formatYamlValue(value)}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

/**
 * Formats a value for YAML output.
 *
 * @param {unknown} val
 * @returns {string}
 */
function formatYamlValue(val) {
  if (typeof val === 'string') {
    if (val.includes(':') || val.includes('#') || val.includes('\n') || val.startsWith('[') || val.startsWith('{')) {
      return JSON.stringify(val)
    }
    return val
  }
  return String(val)
}

/**
 * Frontmatter plugin for repoDocs.
 * Extracts YAML frontmatter on parsing and re-serializes frontmatter on document emission.
 */
export default {
  name: 'frontmatter',
  version: '1.0.0',
  priority: 100,

  /**
   * Pre-processes raw markdown to detect and extract frontmatter headers.
   *
   * @param {Object} context
   * @param {string} context.raw
   * @returns {{ raw: string, frontmatter: Record<string, unknown>, metadata: Record<string, unknown>, _frontmatterRaw: string } | void}
   */
  beforeParse({ raw }) {
    if (!raw.startsWith('---')) return

    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
    if (!match) return

    const frontmatterBlock = match[1]
    const parsed = parseYaml(frontmatterBlock)
    const strippedRaw = raw.slice(match[0].length)

    return {
      raw: strippedRaw,
      frontmatter: parsed,
      metadata: parsed,
      _frontmatterRaw: match[0],
    }
  },

  /**
   * Provides title and subtitle from parsed frontmatter if present.
   *
   * @param {Object} context
   * @param {Record<string, unknown>} [context.extra]
   * @returns {{ title?: string, subtitle?: string } | void}
   */
  parseTitle({ extra }) {
    const fm = extra?.frontmatter
    if (!fm || typeof fm !== 'object') return

    const title = typeof fm.title === 'string' ? fm.title.trim() : undefined
    const subtitle =
      typeof fm.subtitle === 'string'
        ? fm.subtitle.trim()
        : typeof fm.description === 'string'
        ? fm.description.trim()
        : undefined

    if (title || subtitle) {
      return { title, subtitle }
    }
  },

  /**
   * Attaches frontmatter metadata to the generated Doc object.
   *
   * @param {Object} context
   * @param {Object} context.doc
   * @param {Record<string, unknown>} [context.extra]
   * @returns {Object}
   */
  afterParse({ doc, extra }) {
    if (extra?.frontmatter) {
      doc.frontmatter = extra.frontmatter
      doc.metadata = { ...(doc.metadata ?? {}), ...extra.frontmatter }
    }
    if (extra?._frontmatterRaw) {
      doc._frontmatterRaw = extra._frontmatterRaw
    }
    return doc
  },

  /**
   * Re-attaches frontmatter block to the emitted markdown if not present.
   *
   * @param {Object} context
   * @param {string} context.markdown
   * @param {Object} context.doc
   * @param {Record<string, unknown>} [context.extra]
   * @returns {string}
   */
  afterEmit({ markdown, doc, extra }) {
    const rawFm = doc?._frontmatterRaw ?? extra?._frontmatterRaw
    const fmObj = doc?.frontmatter ?? extra?.frontmatter

    if (!rawFm && !fmObj) return markdown
    if (markdown.startsWith('---')) return markdown

    const header = rawFm ? rawFm.trimEnd() : serializeYaml(fmObj)
    return `${header}\n\n${markdown.trimStart()}`
  },
}
