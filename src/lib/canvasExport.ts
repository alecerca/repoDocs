import { toBlob } from 'html-to-image'

export interface CanvasExportOptions {
  pixelRatio?: number
  framing?: 'composition' | 'viewport'
  background?: 'canvas' | 'solid' | 'transparent'
  includeHeader?: boolean
  padding?: number
  project?: string
  doc?: string
}

export interface CanvasBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/**
 * Calculates the bounding box coordinates of all canvas cards.
 *
 * @param cards Array of HTML card elements within the canvas world.
 * @returns The bounding box containing min and max coordinates and total dimensions.
 */
export function getCanvasCompositionBounds(cards: HTMLElement[]): CanvasBounds {
  if (cards.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const card of cards) {
    const left = parseFloat(card.style?.left ?? '') || card.offsetLeft || 0
    const top = parseFloat(card.style?.top ?? '') || card.offsetTop || 0
    const w = card.offsetWidth || 380
    const h = card.offsetHeight || 200

    if (left < minX) minX = left
    if (top < minY) minY = top
    if (left + w > maxX) maxX = left + w
    if (top + h > maxY) maxY = top + h
  }

  const width = Math.max(100, maxX - minX)
  const height = Math.max(100, maxY - minY)

  return { minX, minY, maxX, maxY, width, height }
}

/**
 * Exports the canvas composition or viewport into a PNG Blob.
 *
 * @param viewportEl The root viewport HTML element of the canvas.
 * @param options Export configuration parameters including framing and resolution.
 * @returns A promise resolving to the generated PNG image Blob.
 */
export async function exportCanvasToBlob(
  viewportEl: HTMLElement,
  options: CanvasExportOptions = {}
): Promise<Blob> {
  const pixelRatio = options.pixelRatio ?? 2
  const framing = options.framing ?? 'composition'
  const background = options.background ?? 'canvas'
  const includeHeader = options.includeHeader ?? true
  const padding = options.padding ?? 48

  if (framing === 'viewport') {
    return await toBlob(viewportEl, {
      pixelRatio,
      cacheBust: true,
      filter: (node) => {
        const el = node as HTMLElement
        if (!el || !el.classList) return true
        return (
          !el.classList.contains('canvas-toolbar') &&
          !el.classList.contains('inspector')
        )
      },
    }) as Blob
  }

  const cards = Array.from(viewportEl.querySelectorAll<HTMLElement>('.canvas-card'))
  const bounds = getCanvasCompositionBounds(cards)

  const headerHeight = includeHeader ? 56 : 0
  const stageWidth = bounds.width + padding * 2
  const stageHeight = bounds.height + padding * 2 + headerHeight

  const stage = document.createElement('div')
  stage.className = 'canvas-export-stage'
  stage.style.position = 'fixed'
  stage.style.left = '0'
  stage.style.top = '0'
  stage.style.zIndex = '-99999'
  stage.style.width = `${stageWidth}px`
  stage.style.height = `${stageHeight}px`
  stage.style.boxSizing = 'border-box'
  stage.style.overflow = 'hidden'

  if (background === 'canvas') {
    stage.style.backgroundColor = 'var(--bg, #131315)'
    stage.style.backgroundImage = 'radial-gradient(circle, var(--border, #2b2b2f) 1px, transparent 1px)'
    stage.style.backgroundSize = '24px 24px'
  } else if (background === 'solid') {
    stage.style.backgroundColor = 'var(--bg, #131315)'
  } else {
    stage.style.backgroundColor = 'transparent'
  }

  if (includeHeader && (options.project || options.doc)) {
    const header = document.createElement('div')
    header.className = 'canvas-export-header'
    header.style.position = 'absolute'
    header.style.left = `${padding}px`
    header.style.top = `${padding}px`
    header.style.height = '36px'
    header.style.display = 'flex'
    header.style.alignItems = 'center'
    header.style.gap = '10px'
    header.style.fontFamily = 'Inter, system-ui, sans-serif'
    header.style.fontSize = '14px'
    header.style.fontWeight = '600'
    header.style.color = 'var(--text, #ececee)'

    const brand = document.createElement('span')
    brand.textContent = 'repoDocs'
    brand.style.color = 'var(--accent, #8490b8)'
    header.appendChild(brand)

    const sep = document.createElement('span')
    sep.textContent = '•'
    sep.style.color = 'var(--muted, #84848c)'
    header.appendChild(sep)

    const title = document.createElement('span')
    title.textContent = `${options.project ?? ''} / ${options.doc ?? ''}`
    header.appendChild(title)

    stage.appendChild(header)
  }

  const topOffset = padding + headerHeight

  for (const card of cards) {
    const clone = card.cloneNode(true) as HTMLElement
    const left = parseFloat(card.style.left) || card.offsetLeft || 0
    const top = parseFloat(card.style.top) || card.offsetTop || 0
    clone.style.left = `${left - bounds.minX + padding}px`
    clone.style.top = `${top - bounds.minY + topOffset}px`
    clone.classList.remove('selected')
    stage.appendChild(clone)
  }

  document.body.appendChild(stage)

  try {
    const blob = await toBlob(stage, {
      pixelRatio,
      cacheBust: true,
    })
    if (!blob) {
      throw new Error('Failed to generate PNG blob')
    }
    return blob
  } finally {
    stage.remove()
  }
}

/**
 * Exports the canvas composition or viewport into a base64-encoded PNG data URL.
 *
 * @param viewportEl The root viewport HTML element of the canvas.
 * @param options Export configuration parameters.
 * @returns A promise resolving to the data URL string.
 */
export async function exportCanvasToDataUrl(
  viewportEl: HTMLElement,
  options: CanvasExportOptions = {}
): Promise<string> {
  const blob = await exportCanvasToBlob(viewportEl, options)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Triggers a browser download of the generated PNG file.
 *
 * @param blob The generated image Blob.
 * @param filename The destination file name.
 */
export function downloadCanvasPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.png') ? filename : `${filename}.png`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Copies the generated PNG Blob to the operating system clipboard.
 *
 * @param blob The image Blob to copy.
 * @returns A promise resolving to true if clipboard write succeeded, false otherwise.
 */
export async function copyCanvasPngToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      return true
    } catch {
      return false
    }
  }
  return false
}
