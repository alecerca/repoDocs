import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './state/AppContext'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { BoardView, CanvasView } from './components/Views'
import { PhoneMock } from './components/PhoneMock'
import { subscribeToast } from './lib/toast'

function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => subscribeToast((m) => setMsg(m)), [])
  useEffect(() => {
    if (!msg) return
    const t = window.setTimeout(() => setMsg(null), 2200)
    return () => window.clearTimeout(t)
  }, [msg])
  if (!msg) return null
  return <div className="toast">{msg}</div>
}

function Shell() {
  const { view, fontScale, theme, lang, setView } = useApp()

  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(16 * (fontScale / 100))}px`
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = lang
  }, [fontScale, theme, lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement | null
      const typing = target?.closest?.('input, textarea, select, [contenteditable="true"]')
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
        return
      }
      if (typing || mod) return
      const k = e.key.toLowerCase()
      if (k === 'b') {
        setView('board')
        return
      }
      if (k === 'c') {
        setView('canvas')
        return
      }
      if (k === 'e') {
        const card = target?.closest?.('[data-edit]') as HTMLElement | null
        const ekey = card?.getAttribute('data-edit')
        if (ekey) {
          window.dispatchEvent(new CustomEvent('repoDocs:edit', { detail: ekey }))
        } else {
          const inspectorTa = document.querySelector('.inspector textarea') as HTMLTextAreaElement | null
          inspectorTa?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setView])

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <TopBar />
        <div className="content">{view === 'board' ? <BoardView /> : <CanvasView />}</div>
      </div>
      <ToastHost />
      <PhoneMock />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}