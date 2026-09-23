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
  const { view, fontScale, theme } = useApp()

  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(16 * (fontScale / 100))}px`
    document.documentElement.dataset.theme = theme
  }, [fontScale, theme])

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