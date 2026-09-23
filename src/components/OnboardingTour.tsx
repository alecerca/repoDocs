import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'

const SEEN_KEY = 'pb:seenTour'

type Step = { sel: string; icon: string; title: string; body: string }

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function OnboardingTour() {
  const { t } = useApp()
  const [show, setShow] = useState(false)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY) !== '1') setShow(true)
  }, [])

  const steps: Step[] = useMemo(
    () => [
      { sel: '#global-search', icon: '🔍', title: t('tour.step1.title'), body: t('tour.step1.body') },
      { sel: '.card:not(.intro):not(.summary)', icon: '✏️', title: t('tour.step2.title'), body: t('tour.step2.body') },
      { sel: '.topbar .btn.primary', icon: '💾', title: t('tour.step3.title'), body: t('tour.step3.body') },
      { sel: '.view-toggle', icon: '◧', title: t('tour.step4.title'), body: t('tour.step4.body') },
    ],
    [t]
  )

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* noop */
    }
    setShow(false)
  }

  const step = steps[Math.min(idx, steps.length - 1)]
  const last = idx === steps.length - 1

  useEffect(() => {
    if (!show) return
    const el = document.querySelector(step.sel)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [show, idx, step.sel])

  if (!show) return null

  const el = document.querySelector(step.sel)
  const rect = el?.getBoundingClientRect() ?? null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const CARD_W = 320

  const style: Record<string, string | number> = rect
    ? {
        position: 'fixed',
        left: clamp(rect.left, 12, vw - CARD_W - 12),
        top: rect.bottom + 14 < vh - 220 ? rect.bottom + 14 : Math.max(12, rect.top - 218),
      }
    : { position: 'fixed', left: vw / 2 - CARD_W / 2, top: vh / 2 - 110 }

  return (
    <div className="tour-root">
      <div className="tour-backdrop" />
      {rect && <span className="tour-highlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />}
      <div className="tour-card" style={style}>
        <div className="tour-card-head">
          <span className="tour-icon">{step.icon}</span>
          <span className="tour-count">
            {idx + 1} / {steps.length}
          </span>
        </div>
        <h4 className="tour-title">{step.title}</h4>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="btn ghost xs" onClick={finish}>
            {t('tour.skip')}
          </button>
          <button type="button" className="btn primary sm" onClick={() => (last ? finish() : setIdx(idx + 1))}>
            {last ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>
  )
}