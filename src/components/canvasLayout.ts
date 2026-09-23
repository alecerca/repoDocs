import type { CanvasLayout } from '../lib/registry'

/** Layout por defecto (cascada en columnas) para el canvas. */
export function newSectionDefaults(idx: number): CanvasLayout {
  const col = 4
  const x = 80 + (idx % col) * 400
  const y = 90 + Math.floor(idx / col) * 320
  return { x, y, w: 380, collapsed: false }
}