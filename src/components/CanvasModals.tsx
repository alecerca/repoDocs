import { useState, useEffect, useCallback, type RefObject } from 'react'
import { useApp } from '../state/AppContext'
import { toast } from '../lib/toast'
import type { CanvasLayout } from '../lib/registry'
import {
  exportCanvasToBlob,
  downloadCanvasPng,
  copyCanvasPngToClipboard,
} from '../lib/canvasExport'
import {
  serializeCanvasLayout,
  buildShareUrl,
} from '../lib/canvasShare'

export interface CanvasExportModalProps {
  open: boolean
  onClose: () => void
  viewportRef: RefObject<HTMLDivElement | null>
  project: string
  doc: string
}

/**
 * Modal dialog for configuring and executing canvas PNG export.
 *
 * @param props Configuration and lifecycle properties for the modal.
 * @returns The rendered export dialog component.
 */
export function CanvasExportModal({
  open,
  onClose,
  viewportRef,
  project,
  doc,
}: CanvasExportModalProps) {
  const { t } = useApp()
  const [framing, setFraming] = useState<'composition' | 'viewport'>('composition')
  const [resolution, setResolution] = useState<1 | 2>(2)
  const [background, setBackground] = useState<'canvas' | 'solid' | 'transparent'>('canvas')
  const [includeHeader, setIncludeHeader] = useState<boolean>(true)
  const [isExporting, setIsExporting] = useState<boolean>(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose()
      }
    },
    [onClose, isExporting]
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  const handleDownload = async () => {
    const el = viewportRef.current
    if (!el) return
    setIsExporting(true)
    try {
      const blob = await exportCanvasToBlob(el, {
        pixelRatio: resolution,
        framing,
        background,
        includeHeader,
        project,
        doc,
      })
      const filename = `${project}-${doc.replace(/\.md$/, '')}-canvas.png`
      downloadCanvasPng(blob, filename)
      toast(t('toast.pngDownloaded'))
      onClose()
    } catch {
      toast(t('toast.exportFailed'))
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopyImage = async () => {
    const el = viewportRef.current
    if (!el) return
    setIsExporting(true)
    try {
      const blob = await exportCanvasToBlob(el, {
        pixelRatio: resolution,
        framing,
        background,
        includeHeader,
        project,
        doc,
      })
      const copied = await copyCanvasPngToClipboard(blob)
      if (copied) {
        toast(t('toast.imageCopied'))
        onClose()
      } else {
        const filename = `${project}-${doc.replace(/\.md$/, '')}-canvas.png`
        downloadCanvasPng(blob, filename)
        toast(t('toast.pngDownloaded'))
        onClose()
      }
    } catch {
      toast(t('toast.exportFailed'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="canvas-modal-root" role="dialog" aria-modal="true" aria-label={t('canvas.export.modalTitle')}>
      <div className="canvas-modal-backdrop" onClick={isExporting ? undefined : onClose} />
      <div className="canvas-modal-card">
        <header className="canvas-modal-head">
          <h3 className="canvas-modal-title">{t('canvas.export.modalTitle')}</h3>
          <button
            type="button"
            className="btn ghost xs"
            onClick={onClose}
            disabled={isExporting}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="canvas-modal-body">
          <div className="canvas-modal-field">
            <label className="canvas-field-label">{t('canvas.export.framing')}</label>
            <div className="canvas-toggle-group">
              <button
                type="button"
                className={`canvas-toggle-btn${framing === 'composition' ? ' active' : ''}`}
                onClick={() => setFraming('composition')}
              >
                {t('canvas.export.composition')}
              </button>
              <button
                type="button"
                className={`canvas-toggle-btn${framing === 'viewport' ? ' active' : ''}`}
                onClick={() => setFraming('viewport')}
              >
                {t('canvas.export.viewport')}
              </button>
            </div>
          </div>

          <div className="canvas-modal-field">
            <label className="canvas-field-label">{t('canvas.export.resolution')}</label>
            <div className="canvas-toggle-group">
              <button
                type="button"
                className={`canvas-toggle-btn${resolution === 1 ? ' active' : ''}`}
                onClick={() => setResolution(1)}
              >
                {t('canvas.export.scale1x')}
              </button>
              <button
                type="button"
                className={`canvas-toggle-btn${resolution === 2 ? ' active' : ''}`}
                onClick={() => setResolution(2)}
              >
                {t('canvas.export.scale2x')}
              </button>
            </div>
          </div>

          <div className="canvas-modal-field">
            <label className="canvas-field-label">{t('canvas.export.background')}</label>
            <div className="canvas-toggle-group">
              <button
                type="button"
                className={`canvas-toggle-btn${background === 'canvas' ? ' active' : ''}`}
                onClick={() => setBackground('canvas')}
              >
                {t('canvas.export.bgCanvas')}
              </button>
              <button
                type="button"
                className={`canvas-toggle-btn${background === 'solid' ? ' active' : ''}`}
                onClick={() => setBackground('solid')}
              >
                {t('canvas.export.bgSolid')}
              </button>
              <button
                type="button"
                className={`canvas-toggle-btn${background === 'transparent' ? ' active' : ''}`}
                onClick={() => setBackground('transparent')}
              >
                {t('canvas.export.bgTransparent')}
              </button>
            </div>
          </div>

          {framing === 'composition' && (
            <div className="canvas-modal-checkbox-row">
              <label className="canvas-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                />
                <span>{t('canvas.export.header')}</span>
              </label>
            </div>
          )}
        </div>

        <footer className="canvas-modal-actions">
          <button
            type="button"
            className="btn ghost sm"
            onClick={onClose}
            disabled={isExporting}
          >
            {t('editor.cancel')}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={handleCopyImage}
            disabled={isExporting}
          >
            {t('canvas.export.copy')}
          </button>
          <button
            type="button"
            className="btn primary sm"
            onClick={handleDownload}
            disabled={isExporting}
          >
            {isExporting ? t('canvas.export.generating') : t('canvas.export.download')}
          </button>
        </footer>
      </div>
    </div>
  )
}

export interface CanvasShareModalProps {
  open: boolean
  onClose: () => void
  project: string
  doc: string
  positions: Record<string, CanvasLayout>
  transform: { x: number; y: number; scale: number }
}

/**
 * Modal dialog for generating and copying a shareable canvas layout URL.
 *
 * @param props Target document coordinates and lifecycle handlers.
 * @returns The rendered share dialog component.
 */
export function CanvasShareModal({
  open,
  onClose,
  project,
  doc,
  positions,
  transform,
}: CanvasShareModalProps) {
  const { t } = useApp()
  const [includeCamera, setIncludeCamera] = useState<boolean>(true)
  const [copied, setCopied] = useState<boolean>(false)

  const payload = serializeCanvasLayout(
    project,
    doc,
    positions,
    includeCamera ? transform : undefined
  )
  const shareUrl = buildShareUrl(payload)

  const handleClose = useCallback(() => {
    setCopied(false)
    onClose()
  }, [onClose])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    },
    [handleClose]
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast(t('toast.shareCopied'))
    } catch {
      toast(t('toast.copyFail'))
    }
  }

  return (
    <div className="canvas-modal-root" role="dialog" aria-modal="true" aria-label={t('canvas.share.modalTitle')}>
      <div className="canvas-modal-backdrop" onClick={handleClose} />
      <div className="canvas-modal-card">
        <header className="canvas-modal-head">
          <h3 className="canvas-modal-title">{t('canvas.share.modalTitle')}</h3>
          <button
            type="button"
            className="btn ghost xs"
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="canvas-modal-body">
          <p className="canvas-modal-desc">{t('canvas.share.desc')}</p>

          <div className="canvas-share-target">
            <span className="crumb-project">{project}</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-doc">{doc}</span>
          </div>

          <div className="canvas-modal-checkbox-row">
            <label className="canvas-checkbox-label">
              <input
                type="checkbox"
                checked={includeCamera}
                onChange={(e) => {
                  setIncludeCamera(e.target.checked)
                  setCopied(false)
                }}
              />
              <span>{t('canvas.share.includeCamera')}</span>
            </label>
          </div>

          <div className="canvas-share-input-row">
            <input
              type="text"
              readOnly
              className="canvas-share-input"
              value={shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              className={`btn sm${copied ? ' ghost' : ' primary'}`}
              onClick={handleCopy}
            >
              {copied ? t('canvas.share.copied') : t('canvas.share.copy')}
            </button>
          </div>
        </div>

        <footer className="canvas-modal-actions">
          <button type="button" className="btn ghost sm" onClick={handleClose}>
            {t('editor.cancel')}
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn ghost sm"
          >
            Open in new tab ↗
          </a>
        </footer>
      </div>
    </div>
  )
}
