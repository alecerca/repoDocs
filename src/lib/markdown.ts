import { Marked, type Tokens } from 'marked'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import bash from 'highlight.js/lib/languages/bash'
import diff from 'highlight.js/lib/languages/diff'
import plaintext from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('tsx', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('text', plaintext)
hljs.registerLanguage('plaintext', plaintext)

import { STATUS_META } from './config'

export type StatusKey = 'done' | 'pending' | 'progress'

const STATUS_EMOJI: Record<string, StatusKey> = Object.fromEntries(
  STATUS_META.map((s) => [s.emoji, s.key as StatusKey])
)
const STATUS_EMOJI_ALT = STATUS_META.map((s) => s.emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

const PRIORITY_EMOJI: Record<string, string> = {
  '🥇': 'priority gold',
  '🥈': 'priority silver',
  '🥉': 'priority bronze',
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'y')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Convierte el "trailer" de un heading (— ✅ Completada, 🥇, etc.) en chips */
let markedInstance: Marked | null = null

function buildMarked(): Marked {
  const renderer = {
    code({ text, lang }: Tokens.Code) {
      const code = text.replace(/\n$/, '')
      let highlighted: string
      if (lang != null && lang !== '') {
        const safeLang = lang.toLowerCase().trim()
        if (hljs.getLanguage(safeLang)) {
          highlighted = hljs.highlight(code, { language: safeLang }).value
        } else {
          highlighted = `${escapeHtml(code)}`
        }
      } else {
        highlighted = hljs.highlightAuto(code).value
      }
      return `<div class="code-block"><button type="button" class="code-copy" aria-label="Copiar código">Copiar</button><pre><code class="hljs">${highlighted}</code></pre></div>`
    },
    heading({ text, depth }: Tokens.Heading) {
      const id = slugifyHeading(text)
      const chips: string[] = []
      let core = text
      const statusMatch = core.match(new RegExp(`(\\s*[-—–]\\s*)(${STATUS_EMOJI_ALT})\\s*([^:\\n]*)$`))
      if (statusMatch) {
        const key = STATUS_EMOJI[statusMatch[2]]
        chips.push(`<span class="chip chip-${key}">${statusMatch[2]} ${statusMatch[3].trim()}</span>`)
        core = core.slice(0, (core.length - statusMatch[0].length)) + ' '
      }
      const prioMatch = core.match(/(\s*)(🥇|🥈|🥉)(\s*)$/)
      if (prioMatch) {
        const key = PRIORITY_EMOJI[prioMatch[2]]
        chips.push(`<span class="chip ${key}">${prioMatch[2]}</span>`)
        core = core.slice(0, core.length - prioMatch[0].length) + ' '
      }
      const tag = depth === 1 ? 'h1' : depth === 2 ? 'h2' : depth === 3 ? 'h3' : depth === 4 ? 'h4' : 'h5'
      return `<${tag} id="${id}"><a class="anchor" href="#${id}" aria-label="Enlace a sección">#</a>${core}${chips.join('')}</${tag}>`
    },
  }
  return new Marked({
    gfm: true,
    breaks: false,
    async: false,
    renderer,
  })
}

export function renderMarkdown(md: string): string {
  if (!markedInstance) markedInstance = buildMarked()
  return markedInstance.parse(md, { async: false }) as string
}