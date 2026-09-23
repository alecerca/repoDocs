import { useApp } from '../state/AppContext'
import { brandFor } from '../lib/palette'
import { APPS } from '../lib/config'

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
}

export function findApp(project: string): { name: string; screen: Screen } | null {
  const hit = APPS.find((a) => !a.forProject || a.forProject === project)
  if (!hit) return null
  return { name: hit.name, screen: hit.screen as unknown as Screen }
}

export function PhoneMock() {
  const { previewOpen, setPreviewOpen, activeProject, t } = useApp()
  const brand = brandFor(activeProject)
  const app = findApp(activeProject)

  if (!previewOpen) return null

  return (
    <div className="mock-overlay" onClick={() => setPreviewOpen(false)}>
      <div className="mock-stage" onClick={(e) => e.stopPropagation()}>
        <div className="phone-frame">
          <div className="phone-notch" />
          {app ? (
            app.screen.kind === 'party' ? (
              <PartyMock screen={app.screen as Screen & { players: string[]; games: Game[]; sample: Sample }} />
            ) : (
              <ImpostorMock screen={app.screen as Screen & { players: string[]; categories: string[] }} />
            )
          ) : (
            <div className="phone-screen empty">
              <p>{t('mock.empty', { project: activeProject || t('inspector.section') })}</p>
            </div>
          )}
        </div>
        <div className="mock-side">
          <h2>
            {t('mock.side.title')} <em style={{ color: brand.accent }}>{app?.name ?? brand.name}</em>
          </h2>
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