import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { brandFor } from '../lib/palette'
import { APPS, WEBSITES } from '../lib/config'

type Game = { name: string; icon: string; gradient: string[]; desc: string }
type Sample = { label: string; text: string }
type Screen = {
  kind: string
  title: string
  subtitle: string
  players?: string[]
  games?: Game[]
  sample?: Sample
  categories?: string[]
  options?: string[]
  pro?: string
  proBadge?: string
  button?: string
  nav?: string[]
  hero?: string
  sub?: string
  points?: string[]
  cta?: string
  cta2?: string
}

export function findApp(project: string): { name: string; screen: Screen } | null {
  const hit = APPS.find((a) => !a.forProject || a.forProject === project)
  if (!hit) return null
  return { name: hit.name, screen: hit.screen as unknown as Screen }
}

export function findWeb(project: string): { name: string; url?: string; title?: string; screen: Screen } | null {
  const hit = WEBSITES.find((w) => !w.forProject || w.forProject === project)
  if (!hit) return null
  return { name: hit.name, url: hit.url, title: hit.title, screen: hit.screen as unknown as Screen }
}

type Mode = 'app' | 'web'

export function PhoneMock() {
  const { previewOpen, setPreviewOpen, activeProject, t } = useApp()
  const brand = brandFor(activeProject)
  const app = findApp(activeProject)
  const web = findWeb(activeProject)
  const [mode, setMode] = useState<Mode>('app')
  const effectiveMode = (mode === 'web' && !web) || (mode === 'app' && !app) ? (app ? 'app' : 'web') : mode

  if (!previewOpen) return null

  return (
    <div className="mock-overlay" onClick={() => setPreviewOpen(false)}>
      <div className="mock-stage" onClick={(e) => e.stopPropagation()}>
        {app || web ? (
          effectiveMode === 'web' && web ? (
            <WebFrame
              project={activeProject}
              web={web}
              title={web.title ?? web.screen.title ?? brand.name}
            />
          ) : app ? (
            <div className="phone-frame">
              <div className="phone-notch" />
              {app.screen.kind === 'party' ? (
                <PartyMock screen={app.screen as Screen & { players: string[]; games: Game[]; sample: Sample }} />
              ) : (
                <ImpostorMock screen={app.screen as Screen & { players: string[]; categories: string[] }} />
              )}
            </div>
          ) : null
        ) : (
          <div className="phone-frame">
            <div className="phone-notch" />
            <div className="phone-screen empty">
              <p>{t('mock.empty', { project: activeProject || t('inspector.section') })}</p>
            </div>
          </div>
        )}

        <div className="mock-side">
          <h2>
            {t('mock.side.title')} <em style={{ color: brand.accent }}>{web?.name ?? app?.name ?? brand.name}</em>
          </h2>
          <div className="mock-tabs" role="group" aria-label="Preview mode">
            <button
              type="button"
              className={effectiveMode === 'app' ? 'on' : ''}
              onClick={() => setMode('app')}
              disabled={!app}
            >
              📱 {t('top.app')}
            </button>
            <button
              type="button"
              className={effectiveMode === 'web' ? 'on' : ''}
              onClick={() => setMode('web')}
              disabled={!web}
            >
              🌐 {t('preview.web')}
            </button>
          </div>
          <p>{t('mock.side.desc')}</p>
          <div className="swatch-row big">
            {brand.palette.map((c) => (
              <span key={c} className="swatch" style={{ background: c }} title={c} />
            ))}
          </div>
          <button className="btn ghost sm" onClick={() => setPreviewOpen(false)}>
            {t('mock.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function renderPhoneScreen(screen: Screen) {
  if (screen.kind === 'party')
    return <PartyMock screen={screen as Screen & { players: string[]; games: Game[]; sample: Sample }} />
  return <ImpostorMock screen={screen as Screen & { players: string[]; categories: string[] }} />
}

function WebFrame({ project, web, title }: { project: string; web: { url?: string; screen: Screen }; title: string }) {
  return (
    <div className="browser-frame">
      <div className="browser-bar">
        <span className="browser-dots">
          <i className="close" />
          <i className="min" />
          <i className="max" />
        </span>
        <span className="browser-url">
          <span className="browser-scheme">https</span>://{web.url ?? `${project}.example.com`}
        </span>
      </div>
      <div className="browser-body">
        {web.screen.kind === 'landing' ? (
          <LandingMock screen={web.screen} title={title} />
        ) : (
          renderPhoneScreen(web.screen)
        )}
      </div>
    </div>
  )
}

function LandingMock({ screen, title }: { screen: Screen; title: string }) {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <strong>{screen.title ?? title}</strong>
        {screen.nav?.map((n) => (
          <a key={n}>{n}</a>
        ))}
      </nav>
      <div className="landing-hero">
        <h2>{screen.hero}</h2>
        {screen.sub && <p>{screen.sub}</p>}
        <div className="landing-ctas">
          {screen.cta && <button className="btn primary sm">{screen.cta}</button>}
          {screen.cta2 && <button className="btn ghost sm">{screen.cta2}</button>}
        </div>
        {screen.points && (
          <div className="landing-points">
            {screen.points.map((p) => (
              <span className="landing-point" key={p}>
                ✓ {p}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PartyMock({ screen }: { screen: Screen & { players: string[]; games: Game[]; sample: Sample } }) {
  const players = Array.isArray(screen.players) ? screen.players : []
  const games = Array.isArray(screen.games) ? screen.games.slice(0, 3) : []
  return (
    <div className="phone-screen party">
      <header className="phone-header">
        <h3>{screen.title}</h3>
        <span className="phone-sub">{screen.subtitle}</span>
      </header>
      <div className="players-row">
        {players.map((n, i) => {
          const colors = games.map((g) => g.gradient[0])
          const playersColors = games.length ? [...colors] : ['#7f8bb3', '#9f7fb8', '#6f9cb3']
          return (
            <span
              className="phone-pill"
              key={n}
              style={{ background: `${playersColors[i % playersColors.length]}55` }}
            >
              {n}
            </span>
          )
        })}
        <span className="phone-pill add">+</span>
      </div>
      {games.map((g) => (
        <div
          className="game-card"
          key={g.name}
          style={{ background: `linear-gradient(135deg, ${g.gradient[0]}, ${g.gradient[1]})` }}
        >
          <span className="game-icon">{g.icon}</span>
          <div>
            <strong>{g.name}</strong>
            <span className="game-desc">{g.desc}</span>
          </div>
        </div>
      ))}
      {screen.sample && (
        <div className="sample-card">
          <small>{screen.sample.label}</small>
          <p>{screen.sample.text}</p>
        </div>
      )}
    </div>
  )
}

function ImpostorMock({ screen }: { screen: Screen & { players: string[]; categories: string[] } }) {
  const players = Array.isArray(screen.players) ? screen.players : []
  const categories = Array.isArray(screen.categories) ? screen.categories : []
  const options = Array.isArray(screen.options) ? screen.options : []
  const avatars = ['#7c5df8', '#f59e0b', '#22c55e', '#ff4466', '#eab308', '#6f9cb3', '#9f7fb8']
  return (
    <div className="phone-screen impostor">
      <header className="phone-header">
        <h3>{screen.title}</h3>
        <span className="phone-sub">{screen.subtitle}</span>
      </header>
      <div className="mock-section">
        <small className="mock-label">Jugadores · {players.length}</small>
        <div className="players-grid">
          {players.map((n, i) => (
            <span className="phone-avatar" key={n} style={{ background: avatars[i % avatars.length] }}>
              {n[0]}
              <i>{n}</i>
            </span>
          ))}
          <span className="phone-avatar add">+</span>
        </div>
      </div>
      {categories.length > 0 && (
        <div className="mock-section">
          <small className="mock-label">Categoría</small>
          <div className="cat-chips">
            {categories.map((c, i) => (
              <span key={c} className={`cat-chip${i === 0 ? ' on' : ''}`}>
                {c}
              </span>
            ))}
            <span className="cat-chip plus">＋</span>
          </div>
        </div>
      )}
      <div className="mock-section">
        <small className="mock-label">Opciones</small>
        {options.map((o) => (
          <div className="opt-row" key={o}>
            <span>{o}</span>
            <span className="toggle">🎚️</span>
          </div>
        ))}
        {screen.pro && (
          <div className="opt-row pro">
            <span>{screen.pro}</span>
            <span className="pro-badge">✦ {screen.proBadge ?? 'PRO'}</span>
          </div>
        )}
      </div>
      <button className="start-btn" type="button">
        ▶️ {screen.button ?? 'Empezar partida'}
      </button>
    </div>
  )
}