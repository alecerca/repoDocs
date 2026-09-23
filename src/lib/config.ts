/** Acceso tipado a la config del board (generada por sync desde mdboard.json). */
import type { Brand, StatusMeta, AppPreview, SummaryConfig } from '../generated/appconfig'
import {
  STATUS_META as _META,
  BRANDS as _BRANDS,
  APPS as _APPS,
  SUMMARY as _SUMMARY,
} from '../generated/appconfig'

export type { Brand, StatusMeta, AppPreview, SummaryConfig }

export const STATUS_META: StatusMeta[] = _META
export const BRANDS: Record<string, Brand> = _BRANDS
export const APPS: AppPreview[] = _APPS
export const SUMMARY: SummaryConfig = _SUMMARY

export function statusByKey(key: string): StatusMeta | undefined {
  return STATUS_META.find((s) => s.key === key)
}