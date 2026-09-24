import { toast } from '../../lib/toast'
import { toMermaid } from '../../lib/adrs'
import type { AdrRecord } from '../../lib/adrs'
import { useApp } from '../../state/AppContext'

export function MermaidExport({ records }: { records: AdrRecord[] }) {
  const { t } = useApp()
  if (records.length === 0) return null
  const source = toMermaid(records)
  const project = records[0]!.project || 'adr'
  const copy = () => {
    const fallback = () => {
      const ta = document.createElement('textarea')
      ta.value = source
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } finally {
        ta.remove()
      }
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(source).then(
        () => toast(t('toast.mmdCopied')),
        () => {
          fallback()
          toast(t('toast.mmdCopied'))
        }
      )
    } else {
      fallback()
      toast(t('toast.mmdCopied'))
    }
  }
  const download = () => {
    const blob = new Blob([`${source}\n`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project}.adr.mmd`
    a.click()
    URL.revokeObjectURL(url)
    toast(t('toast.mmdDownloaded'))
  }
  return (
    <>
      <button type="button" className="btn ghost xs" onClick={copy} title={t('adr.mmd.copy.title')}>
        {t('adr.mmd.copy')}
      </button>
      <button type="button" className="btn ghost xs" onClick={download} title={t('adr.mmd.down.title')}>
        {t('adr.mmd.down')}
      </button>
    </>
  )
}