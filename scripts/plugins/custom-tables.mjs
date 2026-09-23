/**
 * Normalizes table cell text for matching and comparison.
 *
 * @param {string} cell
 * @returns {string}
 */
export function normalizeCell(cell) {
  return cell.toLowerCase().replace(/[*`]/g, '').trim()
}

/**
 * Parses markdown table rows between startLine and endLine inclusive.
 *
 * @param {string[]} lines
 * @param {number} startLine
 * @param {number} endLine
 * @returns {string[][]}
 */
export function parseTableRows(lines, startLine, endLine) {
  const rows = []
  for (let i = startLine; i <= endLine; i++) {
    const line = lines[i]
    const body = line.trim().replace(/^\||\|$/g, '')
    if (!body || /^\s*[-:|\s]+\s*$/.test(body)) continue
    const cells = body.split('|').map((c) => c.trim())
    if (cells.length && cells[0] !== '') rows.push(cells)
  }
  return rows
}

/**
 * Checks if a column header signifies a status or progress field.
 *
 * @param {string} header
 * @returns {boolean}
 */
function isStatusColumn(header) {
  return /status|estado|state|progreso|progress|condition|fase|phase/i.test(header)
}

/**
 * Checks if a column header signifies a topic, task, or feature name.
 *
 * @param {string} header
 * @returns {boolean}
 */
function isTopicColumn(header) {
  return /topic|tema|task|tarea|feature|componente|component|item|descrip|modulo|module|titulo|title|name|nombre/i.test(header)
}

/**
 * Checks if a column header signifies an identifier or sequence number.
 *
 * @param {string} header
 * @returns {boolean}
 */
function isIdColumn(header) {
  return /^#?$|num|id|no|code|codigo/i.test(header)
}

/**
 * Custom tables plugin for repoDocs.
 * Parses non-standard status tables with arbitrary column headers and emits custom formatted tables.
 */
export default {
  name: 'custom-tables',
  version: '1.0.0',
  priority: 50,

  /**
   * Scans markdown lines for tables with recognized task/topic and status columns.
   *
   * @param {Object} context
   * @param {string[]} context.lines
   * @param {Object} [context.config]
   * @returns {{ startLine: number, endLine: number, entries: Array<{ num: string, tema: string, estado: string }>, headers: string[] } | null | void}
   */
  parseSummaryTable({ lines }) {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (!trimmed.startsWith('|')) continue

      const rawHeaders = trimmed
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim())
      const normalizedHeaders = rawHeaders.map(normalizeCell)

      let idIdx = normalizedHeaders.findIndex(isIdColumn)
      const topicIdx = normalizedHeaders.findIndex(isTopicColumn)
      const statusIdx = normalizedHeaders.findIndex(isStatusColumn)

      if (topicIdx === -1 || statusIdx === -1) continue

      let end = i
      while (end + 1 < lines.length && lines[end + 1].trim().startsWith('|')) {
        end++
      }

      const rows = parseTableRows(lines, i + 1, end)
      const entries = []

      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r]
        if (cells.length < 2) continue

        const numVal = idIdx !== -1 && cells[idIdx] !== undefined ? cells[idIdx] : String(r + 1)
        const topicVal = cells[topicIdx] ?? ''
        const statusVal = cells[statusIdx] ?? ''

        entries.push({
          num: String(numVal).trim(),
          tema: topicVal.trim(),
          estado: statusVal.trim(),
        })
      }

      if (entries.length > 0) {
        return {
          startLine: i,
          endLine: end,
          entries,
          headers: rawHeaders,
        }
      }
    }

    return null
  },

  /**
   * Emits a Markdown table using custom column headers if present.
   *
   * @param {Object} context
   * @param {Object} context.summary
   * @param {Object} [context.doc]
   * @returns {string | void}
   */
  emitSummaryTable({ summary }) {
    if (!summary || !Array.isArray(summary.entries) || summary.entries.length === 0) return

    const headers = Array.isArray(summary.headers) && summary.headers.length >= 3
      ? summary.headers
      : ['#', 'Topic', 'Status']

    const headerLine = `| ${headers.join(' | ')} |`
    const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`

    const rowLines = summary.entries.map((entry) => {
      const cells = [entry.num ?? '', entry.tema ?? '', entry.estado ?? '']
      return `| ${cells.join(' | ')} |`
    })

    return [headerLine, dividerLine, ...rowLines].join('\n')
  },
}
