/**
 * Checks a text block for checklist checkboxes and returns counts for each status key.
 *
 * @param {string} text
 * @returns {Record<string, number>}
 */
export function countDialectStatusMarkers(text) {
  const counts = { done: 0, pending: 0, progress: 0 }

  const doneMatches = text.match(/^\s*[-*]\s+\[(?:x|X)\]/gm)
  if (doneMatches) counts.done += doneMatches.length

  const progressMatches = text.match(/^\s*[-*]\s+\[(?:\/|-)\]/gm)
  if (progressMatches) counts.progress += progressMatches.length

  const pendingMatches = text.match(/^\s*[-*]\s+\[\s\]/gm)
  if (pendingMatches) counts.pending += pendingMatches.length

  const directiveMatches = text.matchAll(/@status\((done|pending|progress)\)|status::\s*(done|pending|progress)/gi)
  for (const match of directiveMatches) {
    const val = (match[1] || match[2]).toLowerCase()
    if (val in counts) counts[val]++
  }

  return counts
}

/**
 * Dialects plugin for repoDocs.
 * Extracts section status indicators from GitHub-style task lists and markdown directives.
 */
export default {
  name: 'dialects',
  version: '1.0.0',
  priority: 25,

  /**
   * Detects status from task list checkboxes and markdown directives.
   *
   * @param {Object} context
   * @param {string} context.text
   * @returns {Array<{ key: string }> | null}
   */
  detectStatus({ text }) {
    if (!text || typeof text !== 'string') return null

    const counts = countDialectStatusMarkers(text)
    const active = Object.keys(counts)
      .filter((k) => counts[k] > 0)
      .sort((a, b) => counts[b] - counts[a])

    if (active.length === 0) return null

    return active.map((key) => ({ key }))
  },
}
