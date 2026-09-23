import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, basename, extname, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))
const PLUGINS_DIR = resolve(CURRENT_DIR, 'plugins')

/**
 * Manages plugin lifecycle, discovery, filtering, and hook dispatch for repoDocs importers and emitters.
 */
export class PluginManager {
  /**
   * Constructs a PluginManager with an optional array of plugin instances.
   *
   * @param {Array<Object>} [plugins=[]]
   */
  constructor(plugins = []) {
    this.plugins = [...plugins].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  /**
   * Registers an in-memory plugin instance.
   *
   * @param {Object} plugin
   * @returns {void}
   */
  register(plugin) {
    if (!plugin || typeof plugin !== 'object') return
    this.plugins.push(plugin)
    this.plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  /**
   * Returns all plugins active for a given document execution context.
   *
   * @param {Object} context
   * @param {string} [context.projectName]
   * @param {string} [context.file]
   * @param {string} [context.filePath]
   * @returns {Array<Object>}
   */
  getPluginsForContext(context = {}) {
    return this.plugins.filter((plugin) => {
      if (plugin.enabled === false) return false

      if (typeof plugin.match === 'function') {
        try {
          return Boolean(plugin.match(context))
        } catch {
          return false
        }
      }

      if (plugin.projects && context.projectName) {
        if (Array.isArray(plugin.projects)) {
          if (!plugin.projects.includes(context.projectName)) return false
        } else if (plugin.projects instanceof RegExp) {
          if (!plugin.projects.test(context.projectName)) return false
        } else if (typeof plugin.projects === 'string') {
          if (plugin.projects !== context.projectName) return false
        }
      }

      if (plugin.files && context.file) {
        if (Array.isArray(plugin.files)) {
          if (!plugin.files.includes(context.file)) return false
        } else if (plugin.files instanceof RegExp) {
          if (!plugin.files.test(context.file)) return false
        } else if (typeof plugin.files === 'string') {
          if (plugin.files !== context.file) return false
        }
      }

      return true
    })
  }

  /**
   * Executes beforeParse hooks across matching plugins in sequence.
   *
   * @param {Object} context
   * @returns {{ raw: string, extra: Record<string, unknown> }}
   */
  runBeforeParse(context) {
    const active = this.getPluginsForContext(context)
    let currentRaw = context.raw ?? ''
    const extra = { ...(context.extra ?? {}) }

    for (const plugin of active) {
      if (typeof plugin.beforeParse !== 'function') continue
      try {
        const result = plugin.beforeParse({ ...context, raw: currentRaw, extra })
        if (typeof result === 'string') {
          currentRaw = result
        } else if (result && typeof result === 'object') {
          if (typeof result.raw === 'string') currentRaw = result.raw
          for (const [k, v] of Object.entries(result)) {
            if (k !== 'raw') extra[k] = v
          }
        }
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} beforeParse:`, err)
      }
    }

    return { raw: currentRaw, extra }
  }

  /**
   * Executes parseTitle hooks. Returns custom title and subtitle if provided by a plugin.
   *
   * @param {Object} context
   * @returns {{ title?: string, subtitle?: string } | null}
   */
  runParseTitle(context) {
    const active = this.getPluginsForContext(context)
    for (const plugin of active) {
      if (typeof plugin.parseTitle !== 'function') continue
      try {
        const result = plugin.parseTitle(context)
        if (result && typeof result === 'object') {
          if (typeof result.title === 'string' || typeof result.subtitle === 'string') {
            return result
          }
        }
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} parseTitle:`, err)
      }
    }
    return null
  }

  /**
   * Executes parseSummaryTable hooks. Returns custom summary table data if recognized.
   *
   * @param {Object} context
   * @returns {{ startLine: number, endLine: number, entries: Array<{ num: string, tema: string, estado: string }>, headers?: string[] } | null}
   */
  runParseSummaryTable(context) {
    const active = this.getPluginsForContext(context)
    for (const plugin of active) {
      if (typeof plugin.parseSummaryTable !== 'function') continue
      try {
        const result = plugin.parseSummaryTable(context)
        if (result && typeof result === 'object' && Array.isArray(result.entries)) {
          return result
        }
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} parseSummaryTable:`, err)
      }
    }
    return null
  }

  /**
   * Executes parseSections hooks. Returns custom parsed DocSection list if handled by a plugin.
   *
   * @param {Object} context
   * @returns {Array<Object> | null}
   */
  runParseSections(context) {
    const active = this.getPluginsForContext(context)
    for (const plugin of active) {
      if (typeof plugin.parseSections !== 'function') continue
      try {
        const result = plugin.parseSections(context)
        if (Array.isArray(result)) {
          return result
        }
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} parseSections:`, err)
      }
    }
    return null
  }

  /**
   * Executes detectStatus hooks. Returns detected status keys if handled by a plugin.
   *
   * @param {Object} context
   * @returns {Array<{ key: string }> | null}
   */
  runDetectStatus(context) {
    const active = this.getPluginsForContext(context)
    for (const plugin of active) {
      if (typeof plugin.detectStatus !== 'function') continue
      try {
        const result = plugin.detectStatus(context)
        if (Array.isArray(result)) {
          return result.map((item) => (typeof item === 'string' ? { key: item } : item))
        }
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} detectStatus:`, err)
      }
    }
    return null
  }

  /**
   * Executes afterParse hooks across matching plugins on the assembled Doc object.
   *
   * @param {Object} context
   * @returns {Object}
   */
  runAfterParse(context) {
    const active = this.getPluginsForContext(context)
    let currentDoc = context.doc

    for (const plugin of active) {
      if (typeof plugin.afterParse !== 'function') continue
      try {
        const result = plugin.afterParse({ ...context, doc: currentDoc })
        if (result && typeof result === 'object') {
          currentDoc = result
        }
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} afterParse:`, err)
      }
    }

    return currentDoc
  }

  /**
   * Executes beforeEmit hooks prior to document assembly.
   *
   * @param {Object} context
   * @returns {void}
   */
  runBeforeEmit(context) {
    const active = this.getPluginsForContext(context)
    for (const plugin of active) {
      if (typeof plugin.beforeEmit !== 'function') continue
      try {
        plugin.beforeEmit(context)
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} beforeEmit:`, err)
      }
    }
  }

  /**
   * Executes emitSummaryTable hooks. Returns custom rendered Markdown table string if handled.
   *
   * @param {Object} context
   * @returns {string | null}
   */
  runEmitSummaryTable(context) {
    const active = this.getPluginsForContext(context)
    for (const plugin of active) {
      if (typeof plugin.emitSummaryTable !== 'function') continue
      try {
        const result = plugin.emitSummaryTable(context)
        if (typeof result === 'string') {
          return result
        }
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} emitSummaryTable:`, err)
      }
    }
    return null
  }

  /**
   * Executes emitSection hooks. Returns custom rendered Markdown section string if handled.
   *
   * @param {Object} context
   * @returns {string | null}
   */
  runEmitSection(context) {
    const active = this.getPluginsForContext(context)
    for (const plugin of active) {
      if (typeof plugin.emitSection !== 'function') continue
      try {
        const result = plugin.emitSection(context)
        if (typeof result === 'string') {
          return result
        }
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} emitSection:`, err)
      }
    }
    return null
  }

  /**
   * Executes afterEmit hooks on the final assembled Markdown document string.
   *
   * @param {Object} context
   * @returns {string}
   */
  runAfterEmit(context) {
    const active = this.getPluginsForContext(context)
    let currentMarkdown = context.markdown ?? ''

    for (const plugin of active) {
      if (typeof plugin.afterEmit !== 'function') continue
      try {
        const result = plugin.afterEmit({ ...context, markdown: currentMarkdown })
        if (typeof result === 'string') {
          currentMarkdown = result
        }
      } catch (err) {
        console.warn(`[plugins] Warning in ${plugin.name ?? 'plugin'} afterEmit:`, err)
      }
    }

    return currentMarkdown
  }
}

/**
 * Loads all plugins found in scripts/plugins/*.mjs and returns a configured PluginManager.
 *
 * @param {Object} [config={}]
 * @param {string} [customPluginsDir]
 * @returns {Promise<PluginManager>}
 */
export async function loadPlugins(config = {}, customPluginsDir = PLUGINS_DIR) {
  const manager = new PluginManager()

  if (!existsSync(customPluginsDir) || !statSync(customPluginsDir).isDirectory()) {
    return manager
  }

  const entries = readdirSync(customPluginsDir).sort()
  const pluginConfigMap = config.plugins ?? {}

  for (const entry of entries) {
    if (!entry.endsWith('.mjs') || entry.endsWith('.test.mjs') || entry.startsWith('.') || entry.startsWith('_')) {
      continue
    }

    const pluginPath = join(customPluginsDir, entry)
    const pluginBaseName = basename(entry, extname(entry))

    if (pluginConfigMap[pluginBaseName]?.enabled === false) {
      continue
    }

    try {
      const fileUrl = pathToFileURL(pluginPath).href
      const mod = await import(fileUrl)
      const plugin = mod.default ?? mod
      if (plugin && typeof plugin === 'object') {
        if (!plugin.name) plugin.name = pluginBaseName
        if (pluginConfigMap[pluginBaseName]) {
          Object.assign(plugin, pluginConfigMap[pluginBaseName])
        }
        manager.register(plugin)
      }
    } catch (err) {
      console.warn(`[plugins] Failed to load plugin file ${entry}:`, err)
    }
  }

  return manager
}
