import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  clearLicenseToken,
  decodeToken,
  isLicenseValid,
  readLicenseToken,
  writeLicenseToken,
  type LicenseState,
} from '../../lib/license'
import { useApp } from '../../state/AppContext'
import { toast } from '../../lib/toast'
import type { AdrRecord } from '../../lib/adrs'
import { DecisionCard } from './DecisionCard'
import { MermaidExport } from './MermaidExport'

export const FREE_ADR_LIMIT = 10

export type LicenseCtx = {
  state: LicenseState
  activate: (token: string) => Promise<boolean>
  deactivate: () => void
}

const Ctx = createContext<LicenseCtx | null>(null)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LicenseState>({ status: 'checking' })

  useEffect(() => {
    let live = true
    const token = readLicenseToken()
    if (!token) {
      setState({ status: 'none' })
      return
    }
    isLicenseValid(token).then((ok) => {
      if (!live) return
      if (!ok) {
        setState({ status: 'invalid' })
        return
      }
      const { payload } = decodeToken(token)
      setState(payload ? { status: 'valid', payload } : { status: 'invalid' })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activate = async (token: string): Promise<boolean> => {
    const ok = await isLicenseValid(token)
    if (!ok) {
      setState({ status: 'invalid' })
      return false
    }
    writeLicenseToken(token.trim())
    const { payload } = decodeToken(token)
    setState(payload ? { status: 'valid', payload } : { status: 'invalid' })
    return true
  }

  const deactivate = () => {
    clearLicenseToken()
    setState({ status: 'none' })
  }

  return <Ctx.Provider value={{ state, activate, deactivate }}>{children}</Ctx.Provider>
}

export function useLicenseCtx(): LicenseCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLicenseCtx must be used within LicenseProvider')
  return ctx
}

export function useLicensed(): boolean {
  return useContext(Ctx)?.state.status === 'valid'
}

export function LicenseGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { state } = useLicenseCtx()
  if (state.status === 'checking') return <div className="adr-loading">…</div>
  if (state.status === 'valid') return <>{children}</>
  return <>{fallback}</>
}

export function LicensePanel() {
  const { t } = useApp()
  const { state, activate, deactivate } = useLicenseCtx()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        className={`btn ghost xs${state.status === 'valid' ? ' on' : ''}`}
        onClick={() => setOpen(true)}
        title={t('adr.license.btn.title')}
      >
        🔑
      </button>
    )
  }

  const onActivate = async () => {
    if (!token.trim()) return
    setBusy(true)
    const ok = await activate(token)
    setBusy(false)
    if (ok) {
      toast(t('toast.licenseOn'))
      // se mantiene abierto para mostrar el estado activo
    } else {
      toast(t('toast.licenseFail'))
    }
  }

  const onDeactivate = () => {
    deactivate()
    setToken('')
    setOpen(false)
    toast(t('toast.licenseOff'))
  }

  return (
    <div className="license-panel">
      <div className="license-panel-head">
        <strong>{t('adr.license.title')}</strong>
        <button className="btn-icon" onClick={() => setOpen(false)} aria-label={t('inspector.close')}>
          ✕
        </button>
      </div>
      {state.status === 'valid' && state.payload ? (
        <div className="license-panel-state">
          <span className="license-dot" />
          {t('adr.license.active')}
          <span className="license-seats">
            {state.payload.seats} {t('adr.license.seats')}
          </span>
          <button className="btn ghost xs" onClick={onDeactivate}>
            {t('adr.license.remove')}
          </button>
        </div>
      ) : (
        <>
          {state.status === 'invalid' && <p className="license-error">{t('adr.license.invalid')}</p>}
          <textarea
            className="license-input"
            spellCheck={false}
            placeholder={t('adr.license.placeholder')}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button className="btn primary sm" onClick={onActivate} disabled={busy || !token.trim()}>
            {busy ? t('adr.license.verify') : t('adr.license.activate')}
          </button>
        </>
      )}
    </div>
  )
}

export function AdrGroup({
  project,
  adrs,
  supMap,
  count = true,
}: {
  project: string
  adrs: AdrRecord[]
  supMap: Record<string, string[]>
  count?: boolean
}) {
  const { t } = useApp()
  const licensed = useLicensed()
  const visible = licensed ? adrs : adrs.slice(0, FREE_ADR_LIMIT)
  const locked = adrs.length - visible.length

  return (
    <section className="adr-group">
      <h2 className="adr-group-title">
        <span className="adr-project-dot">{project.slice(0, 1)}</span>
        {project}
        {count && <span className="lno">{adrs.length}</span>}
        {(adrs.length > FREE_ADR_LIMIT) && !licensed && <span className="adr-premium-badge">PREMIUM</span>}
        <span className="adr-group-actions">
          <MermaidExport records={adrs} />
        </span>
      </h2>
      {visible.map((rec) => (
        <DecisionCard key={rec.id} rec={rec} supersededBy={supMap[rec.id]} />
      ))}
      {locked > 0 && (
        <div className="adr-locked">
          <span className="adr-locked-icon">🔒</span>
          <span>
            {t('adr.locked.n', { n: locked })}
            <span className="adr-locked-hint">{t('adr.locked.hint')}</span>
          </span>
        </div>
      )}
    </section>
  )
}