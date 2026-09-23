/** Acceso tipado a la config del board (generada por sync desde mdboard.json). */
import type { Brand, StatusMeta, AppPreview, WebPreview, SummaryConfig } from '../generated/appconfig'
import {
  STATUS_META as _META,
  BRANDS as _BRANDS,
  APPS as _APPS,
  WEBSITES as _WEBSITES,
  SUMMARY as _SUMMARY,
} from '../generated/appconfig'

export type { Brand, StatusMeta, AppPreview, WebPreview, SummaryConfig }

export const STATUS_META: StatusMeta[] = _META
export const BRANDS: Record<string, Brand> = _BRANDS
export const APPS: AppPreview[] = _APPS
export const WEBSITES: WebPreview[] = _WEBSITES
export const SUMMARY: SummaryConfig = _SUMMARY

export function statusMetaForDoc(doc?: { statusMeta?: StatusMeta[] } | null): StatusMeta[] {
  return doc?.statusMeta ?? STATUS_META
}

export function statusByKey(
  key: string,
  docOrMeta?: { statusMeta?: StatusMeta[] } | StatusMeta[] | null
): StatusMeta | undefined {
  const metaList = Array.isArray(docOrMeta)
    ? docOrMeta
    : (docOrMeta?.statusMeta ?? STATUS_META)
  return metaList.find((s) => s.key === key) ?? STATUS_META.find((s) => s.key === key)
}