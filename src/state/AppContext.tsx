import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import type { Doc } from '../lib/registry'
import {
  PROJECTS,
  docKey,
  sectionKey,
  assembleRaw,
  INTRO_MARK,
  DOC_ORDER_PRIORITY,
  type ProjectDocs,
  type EditsMap,
  type CanvasMap,
  type CanvasLayout,
} from '../lib/registry'
import { toast } from '../lib/toast'
import { translate, type Lang, type T } from '../lib/i18n'
import type { DocStatus } from '../generated/docs'

export type ViewMode = 'board' | 'canvas'
export type StatusFilter = 'all' | DocStatus

export type { Lang }

type PersistState = {
  theme: 'dark' | 'light'
  view: ViewMode
  fontScale: number
  lang: Lang
  lastProject: string
  lastDoc: string
  search: string
  statusFilter: StatusFilter
  readMode: boolean
}

const UI_KEY = 'pb:ui'
const EDITS_KEY = 'pb:edits'
const CANVAS_KEY = 'pb:canvas'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* noop */
  }
}

const DEFAULT_UI: PersistState = {
  theme: 'dark',
  view: 'board',
  fontScale: 100,
  lang: 'en',
  lastProject: PROJECTS[0]?.project ?? '',
  lastDoc: '',
  search: '',
  statusFilter: 'all',
  readMode: false,
}

function pickDoc(projectName: string, docName: string): { project: string; docName: string } {
  const project = PROJECTS.find((p) => p.project === projectName) ?? PROJECTS[0]
  if (!project) return { project: '', docName: '' }
  let doc = project.docs.find((d) => d.file === docName)
  if (!doc) {
    doc = project.docs.sort((a, b) => DOC_ORDER_PRIORITY(a.file) - DOC_ORDER_PRIORITY(b.file))[0]
  }
  return { project: project.project, docName: doc.file }
}

type Ctx = {
  theme: 'dark' | 'light'
  toggleTheme: () => void
  lang: Lang
  setLang: (l: Lang) => void
  /** Traduce una clave de UI al idioma activo. */
  t: T
  projects: ProjectDocs[]
  activeProject: string
  activeDoc: string
  selectProject: (name: string) => void
  selectDoc: (file: string) => void
  current: Doc | null
  baseKey: string
  view: ViewMode
  setView: (v: ViewMode) => void
  search: string
  setSearch: (s: string) => void
  statusFilter: StatusFilter
  setStatusFilter: (f: StatusFilter) => void
  fontScale: number
  setFontScale: (n: number) => void
  edits: EditsMap
  hasEdits: boolean
  setEdits: (updater: (prev: EditsMap) => EditsMap) => void
  /** Guarda la sección en localStorage y, si el server lo permite, también en el .md real. */
  writeSection: (baseKey: string, key: string, raw: string) => void
  /** Exporta el doc con las ediciones actuales y lo escribe en el .md real. */
  saveCurrentToFile: () => void
  resetEdits: () => void
  canvas: CanvasMap
  setCanvasLayout: (baseKey: string, sectionId: string, layout: CanvasLayout) => void
  removeCanvasLayout: (baseKey: string, sectionId: string) => void
  resetCanvas: (baseKey: string) => void
  selected: string | null
  setSelected: (id: string | null) => void
  previewOpen: boolean
  setPreviewOpen: (b: boolean) => void
  collapsedCmd: boolean | null
  collapseAll: (c: boolean) => void
  readMode: boolean
  setReadMode: (b: boolean) => void
  statusCounts: Record<string, number>
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ui, setUi] = useState<PersistState>(() => {
    const persisted = load<PersistState>(UI_KEY, DEFAULT_UI)
    return { ...DEFAULT_UI, ...persisted }
  })
  const [edits, setEditsState] = useState<EditsMap>(() => load(EDITS_KEY, {}))
  const [canvas, setCanvasState] = useState<CanvasMap>(() => load(CANVAS_KEY, {}))
  const [selected, setSelected] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [collapsedCmd, setCollapsedCmd] = useState<boolean | null>(null)

  const { activeProject, activeDoc } = (() => {
    const picked = pickDoc(ui.lastProject, ui.lastDoc)
    return { activeProject: picked.project, activeDoc: picked.docName }
  })()

  const baseKey = activeDoc ? docKey(activeProject, activeDoc) : ''

  const current = useMemo<Doc | null>(() => {
    const group = PROJECTS.find((p) => p.project === activeProject)
    return group?.docs.find((d) => d.file === activeDoc) ?? null
  }, [activeProject, activeDoc])

  const patchUi = useCallback((patch: Partial<PersistState>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch }
      save(UI_KEY, next)
      return next
    })
  }, [])

  const setEdits = useCallback((updater: (prev: EditsMap) => EditsMap) => {
    setEditsState((prev) => {
      const next = updater(prev)
      save(EDITS_KEY, next)
      return next
    })
  }, [])

  const writeDoc = useCallback(
    async (seed: EditsMap | null) => {
      if (!current) return false
      const md = assembleRaw(current, seed ?? edits, baseKey ?? '')
      try {
        const res = await fetch('/__mdboard/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: current.project, file: current.file, content: md }),
        })
        return res.ok
      } catch {
        return false
      }
    },
    [current, edits, baseKey]
  )

  const t: T = useCallback((key, vars) => translate(ui.lang, key, vars), [ui.lang])

  const writeSection = useCallback(
    (bKey: string, key: string, raw: string) => {
      const next = { ...edits, [sectionKey(bKey, key)]: raw }
      setEdits((prev) => ({ ...prev, [sectionKey(bKey, key)]: raw }))
      void writeDoc(next).then((ok) => {
        toast(ok ? t('toast.sectionSaved') : t('toast.sectionSavedLocal'))
      })
    },
    [edits, setEdits, writeDoc, t]
  )

  const saveCurrentToFile = useCallback(() => {
    void writeDoc(null).then((ok) => {
      toast(ok ? t('toast.fileWritten') : t('toast.fileLocal'))
    })
  }, [writeDoc, t])

  const resetEdits = useCallback(() => {
    const backup = edits
    setEditsState({})
    save(EDITS_KEY, {})
    if (Object.keys(backup).length > 0) {
      toast({
        msg: t('toast.reset'),
        action: {
          label: t('toast.undo'),
          onClick: () => {
            setEditsState(backup)
            save(EDITS_KEY, backup)
          },
        },
      })
    }
  }, [edits, t])

  const setCanvasLayout = useCallback(
    (bKey: string, sectionId: string, layout: CanvasLayout) => {
      setCanvasState((prev) => {
        const next = {
          ...prev,
          [bKey]: { ...(prev[bKey] ?? {}), [sectionId]: layout },
        }
        save(CANVAS_KEY, next)
        return next
      })
    },
    []
  )

  const resetCanvas = useCallback((bKey: string) => {
    setCanvasState((prev) => {
      const next = { ...prev }
      delete next[bKey]
      save(CANVAS_KEY, next)
      return next
    })
  }, [])

  const removeCanvasLayout = useCallback((bKey: string, sectionId: string) => {
    setCanvasState((prev) => {
      const docMap = { ...(prev[bKey] ?? {}) }
      delete docMap[sectionId]
      const next = { ...prev, [bKey]: docMap }
      save(CANVAS_KEY, next)
      return next
    })
  }, [])

  const hasEdits = Object.keys(edits).length > 0

  const statusCounts = useMemo(
    () =>
      current?.statusCounts ?? { done: 0, pending: 0, progress: 0 },
    [current]
  )

  const value: Ctx = {
    theme: ui.theme,
    toggleTheme: () => patchUi({ theme: ui.theme === 'dark' ? 'light' : 'dark' }),
    lang: ui.lang,
    setLang: (l) => patchUi({ lang: l }),
    t,
    projects: PROJECTS,
    activeProject,
    activeDoc,
    selectProject: (name) => {
      setSelected(null)
      const picked = pickDoc(name, '')
      patchUi({
        lastProject: picked.project,
        lastDoc: picked.docName,
      })
    },
    selectDoc: (file) => {
      setSelected(null)
      patchUi({ lastDoc: file })
    },
    current,
    baseKey,
    view: ui.view,
    setView: (v) => patchUi({ view: v }),
    search: ui.search,
    setSearch: (s) => patchUi({ search: s }),
    statusFilter: ui.statusFilter,
    setStatusFilter: (f) => patchUi({ statusFilter: f }),
    fontScale: ui.fontScale,
    setFontScale: (n) => patchUi({ fontScale: Math.max(70, Math.min(140, n)) }),
    edits,
    hasEdits,
    setEdits,
    writeSection,
    saveCurrentToFile,
    resetEdits,
    canvas,
    setCanvasLayout,
    removeCanvasLayout,
    resetCanvas,
    selected,
    setSelected,
    previewOpen,
    setPreviewOpen,
    collapsedCmd,
    collapseAll: setCollapsedCmd,
    readMode: ui.readMode,
    setReadMode: (b) => patchUi({ readMode: b }),
    statusCounts,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}

export { INTRO_MARK }
export type { DocStatus }