import { useApp } from '../state/AppContext'
import { DOC_ORDER_PRIORITY, DOC_TYPE_ICON, typeDocFile } from '../lib/registry'
import { brandFor } from '../lib/palette'

export function Sidebar() {
  const { projects, activeProject, activeDoc, selectProject, selectDoc, t } = useApp()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mark">▦</span>
        <div>
          <strong>repoDocs</strong>
          <span className="logo-sub">markdown board</span>
        </div>
      </div>
      <nav className="project-list">
        {projects.map((group) => {
          const brand = brandFor(group.project)
          const docs = [...group.docs].sort(
            (a, b) => DOC_ORDER_PRIORITY(a.file) - DOC_ORDER_PRIORITY(b.file)
          )
          const isActiveProject = group.project === activeProject
          return (
            <div key={group.project} className="project">
              <button
                type="button"
                className={`project-name${isActiveProject ? ' active' : ''}`}
                onClick={() => selectProject(group.project)}
              >
                <span className="project-dot" style={{ background: brand.accent }} />
                {group.project}
              </button>
              {isActiveProject && (
                <div className="project-docs">
                  {docs.map((doc) => {
                    const active = doc.file === activeDoc
                    const t = typeDocFile(doc.file)
                    return (
                      <button
                        key={doc.file}
                        type="button"
                        className={`doc-link${active ? ' active' : ''}`}
                        onClick={() => selectDoc(doc.file)}
                      >
                        <span className="doc-icon">{DOC_TYPE_ICON[t]}</span>
                        <span className="doc-file">{doc.file}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="swatch-row">
          {brandFor(activeProject).palette.map((c) => (
            <span key={c} className="swatch" style={{ background: c }} />
          ))}
        </div>
        <p className="foot-hint">
          {t('sidebar.foot.hint')}
        </p>
      </div>
    </aside>
  )
}