/** Marcas de identidad por proyecto (vienen de mdboard.json / mdboard.local.json). */
import { BRANDS, type Brand } from './config'

const FALLBACK: Brand = {
  name: 'Proyecto',
  tagline: 'Proyecto',
  accent: '#7f8bb3',
  accent2: '#9f7fb8',
  darkBg: '#131315',
  surface: '#1d1d20',
  surfaceAlt: '#232326',
  text: '#ececee',
  muted: '#84848c',
  palette: ['#7f8bb3', '#9f7fb8'],
  stack: [],
}

export function brandFor(project: string): Brand {
  return BRANDS[project] ?? FALLBACK
}