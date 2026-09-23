import { PluginManager } from './plugins.mjs'

const INTRO_MARK = '\u241E__intro__'

/**
 * Builds section key matching the client-side sectionKey function.
 *
 * @param {string} base
 * @param {string} sectionId
 * @returns {string}
 */
export function sectionKey(base, sectionId) {
  return `${base}::${sectionId}`
}

/**
 * Rebuilds the markdown representation of a summary table.
 *
 * @param {Object} summary
 * @param {Array<{ num: string, tema: string, estado: string }>} summary.entries
 * @param {Object} [config]
 * @param {Object} [config.summary]
 * @param {string[]} [config.summary.headers]
 * @param {string} [heading]
 * @returns {string}
 */
export function rebuildSummaryText(summary, config = {}, heading = null) {
  if (!summary || !Array.isArray(summary.entries)) return ''

  const rows = summary.entries
    .filter((e) => e.num !== '#')
    .map((e) => `| ${e.num} | ${e.tema} | ${e.estado} |`)
    .join('\n')

  const headers = config.summary?.headers ?? ['#', 'Topic', 'Status']
  const [cNum, cTopic, cStatus] = headers
  const headingText = heading ? `${heading}\n\n` : ''

  return `${headingText}| ${cNum} | ${cTopic} | ${cStatus} |\n| --- | --- | --- |\n${rows}`
}

/**
 * Assembles a complete Markdown document from a Doc model, edits map, and plugin emitter hooks.
 *
 * @param {Object} doc
 * @param {Record<string, string>} [edits={}]
 * @param {string} [baseKey='']
 * @param {Object} [options={}]
 * @param {PluginManager} [options.pluginManager]
 * @param {Object} [options.config]
 * @returns {string}
 */
export function assembleDoc(doc, edits = {}, baseKey = '', options = {}) {
  const pluginManager = options.pluginManager ?? new PluginManager()
  const config = options.config ?? {}
  const context = { doc, edits, baseKey, config, extra: {} }

  pluginManager.runBeforeEmit(context)

  const introKey = sectionKey(baseKey, INTRO_MARK)
  const intro = edits[introKey] ?? doc.intro

  const repls = [{ s: 0, e: (doc.introEndLine ?? 0) + 1, text: intro }]

  for (const section of doc.sections ?? []) {
    const sKey = sectionKey(baseKey, section.id)
    let text = edits[sKey] ?? section.raw

    if (section.kind === 'summary' && !edits[sKey] && doc.summary) {
      const customTable = pluginManager.runEmitSummaryTable({ ...context, summary: doc.summary })
      if (customTable) {
        text = section.heading ? `${section.heading}\n\n${customTable}` : customTable
      } else {
        text = rebuildSummaryText(doc.summary, config, section.heading)
      }
    } else {
      const customSection = pluginManager.runEmitSection({ ...context, section, raw: text })
      if (typeof customSection === 'string') {
        text = customSection
      }
    }

    repls.push({
      s: section.startLine - 1,
      e: section.endLine,
      text,
    })
  }

  repls.sort((a, b) => b.s - a.s)

  const lines = (doc.raw ?? '').split('\n')
  for (const r of repls) {
    lines.splice(r.s, Math.max(0, r.e - r.s), ...r.text.split('\n'))
  }

  let assembled = lines.join('\n').trimEnd()
  if (assembled) assembled = `${assembled}\n`

  return pluginManager.runAfterEmit({ ...context, markdown: assembled })
}
