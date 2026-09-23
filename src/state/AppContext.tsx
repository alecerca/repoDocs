import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import type { Doc } from '../lib/registry'
import {
  PROJECTS,
  docKey,
  sectionKey,
  assembleRaw,
  INTRO_MARK,
  DOC_ORDER_PRIORITY,
  parseMarkdownDoc,
  type ProjectDocs,
  type EditsMap,
  type CanvasMap,
  type CanvasLayout,
} from '../lib/registry'
import { toast } from '../lib/toast'
import { translate, type Lang, type T } from '../lib/i18n'
import type { DocStatus } from '../generated/docs'
import type { GitHubUser } from '../lib/github'

export type ViewMode = 'board' | 'canvas'
export type StatusFilter = 'all' | DocStatus

export type { Lang }

export interface RemoteRepoConfig {
  owner: string
  repo: string
  branch: string
}

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
const GH_TOKEN_KEY = 'pb:gh_token'
const GH_USER_KEY = 'pb:gh_user'
const GH_ACTIVE_REPO_KEY = 'pb:gh_active_repo'

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

function pickDocFromList(projectsList: ProjectDocs[], projectName: string, docName: string): { project: string; docName: string } {
  const project = projectsList.find((p) => p.project === projectName) ?? projectsList[0]
  if (!project) return { project: '', docName: '' }
  let doc = project.docs.find((d) => d.file === docName)
  if (!doc) {
    doc = project.docs.slice().sort((a, b) => DOC_ORDER_PRIORITY(a.file) - DOC_ORDER_PRIORITY(b.file))[0]
  }
  return { project: project.project, docName: doc ? doc.file : '' }
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
  statusCounts: { done: number; pending: number; progress: number }
  ghToken: string
  setGhToken: (token: string) => void
  ghUser: GitHubUser | null
  setGhUser: (user: GitHubUser | null) => void
  remoteRepo: RemoteRepoConfig | null
  setRemoteRepo: (repo: RemoteRepoConfig | null) => void
  githubModalOpen: boolean
  setGithubModalOpen: (open: boolean) => void
  remoteDocs: Doc[]
  setRemoteDocs: (docs: Doc[]) => void
  loadRemoteMarkdownFiles: (project: string, files: Array<{ path: string; content: string }>) => void
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
  const [ghToken, setGhTokenState] = useState<string>(() => load(GH_TOKEN_KEY, ''))
  const [ghUser, setGhUserState] = useState<GitHubUser | null>(() => load(GH_USER_KEY, null))
  const [remoteRepo, setRemoteRepoState] = useState<RemoteRepoConfig | null>(() => load(GH_ACTIVE_REPO_KEY, null))
  const [githubModalOpen, setGithubModalOpen] = useState(false)
  const [remoteDocs, setRemoteDocs] = useState<Doc[]>([])

  const setGhToken = useCallback((token: string) => {
    setGhTokenState(token)
    save(GH_TOKEN_KEY, token)
    if (!token) {
      setGhUserState(null)
      save(GH_USER_KEY, null)
    }
  }, [])

  const setGhUser = useCallback((user: GitHubUser | null) => {
    setGhUserState(user)
    save(GH_USER_KEY, user)
  }, [])

  const setRemoteRepo = useCallback((repo: RemoteRepoConfig | null) => {
    setRemoteRepoState(repo)
    save(GH_ACTIVE_REPO_KEY, repo)
  }, [])

  const allProjects = useMemo<ProjectDocs[]>(() => {
    if (remoteDocs.length === 0) return PROJECTS
    const map = new Map<string, Doc[]>()
    for (const p of PROJECTS) {
      map.set(p.project, [...p.docs])
    }
    for (const doc of remoteDocs) {
      if (!map.has(doc.project)) map.set(doc.project, [])
      const existing = map.get(doc.project)!
      const idx = existing.findIndex((d) => d.file === doc.file)
      if (idx >= 0) {
        existing[idx] = doc
      } else {
        existing.push(doc)
      }
    }
    return [...map.entries()].map(([project, docs]) => ({ project, docs }))
  }, [remoteDocs])

  const { activeProject, activeDoc } = useMemo(() => {
    const picked = pickDocFromList(allProjects, ui.lastProject, ui.lastDoc)
    return { activeProject: picked.project, activeDoc: picked.docName }
  }, [allProjects, ui.lastProject, ui.lastDoc])

  const baseKey = activeDoc ? docKey(activeProject, activeDoc) : ''

  const current = useMemo<Doc | null>(() => {
    const group = allProjects.find((p) => p.project === activeProject)
    return group?.docs.find((d) => d.file === activeDoc) ?? null
  }, [allProjects, activeProject, activeDoc])

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

  const loadRemoteMarkdownFiles = useCallback(
    (projectName: string, files: Array<{ path: string; content: string }>) => {
      const newDocs = files.map((f) => parseMarkdownDoc(projectName, f.path, f.content))
      setRemoteDocs((prev) => {
        const filtered = prev.filter((d) => d.project !== projectName)
        return [...filtered, ...newDocs]
      })
      if (newDocs.length > 0) {
        patchUi({
          lastProject: projectName,
          lastDoc: newDocs[0].file,
        })
      }
    },
    [patchUi]
  )

  const value: Ctx = {
    theme: ui.theme,
    toggleTheme: () => patchUi({ theme: ui.theme === 'dark' ? 'light' : 'dark' }),
    lang: ui.lang,
    setLang: (l) => patchUi({ lang: l }),
    t,
    projects: allProjects,
    activeProject,
    activeDoc,
    selectProject: (name) => {
      setSelected(null)
      const picked = pickDocFromList(allProjects, name, '')
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
    ghToken,
    setGhToken,
    ghUser,
    setGhUser,
    remoteRepo,
    setRemoteRepo,
    githubModalOpen,
    setGithubModalOpen,
    remoteDocs,
    setRemoteDocs,
    loadRemoteMarkdownFiles,
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