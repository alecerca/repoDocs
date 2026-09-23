import { useEffect, useState, useCallback, useId } from 'react'
import { useApp } from '../state/AppContext'
import { assembleRaw } from '../lib/registry'
import { toast } from '../lib/toast'
import {
  validateGitHubToken,
  listUserRepos,
  listRepoBranches,
  pullRepoMarkdownFiles,
  pushCommitToBranch,
  pushToPullRequest,
  syncPulledFilesToLocalServer,
  sanitizeRepoFilePath,
  type GitHubRepo,
  type GitHubBranch,
} from '../lib/github'

type TabKey = 'auth' | 'pull' | 'push'

/**
 * Modal dialog for GitHub remote integration: authentication, repository selection,
 * pulling markdown files from remote branches, and pushing commits or pull requests.
 */
export function GitHubModal() {
  const {
    t,
    ghToken,
    setGhToken,
    ghUser,
    setGhUser,
    remoteRepo,
    setRemoteRepo,
    githubModalOpen,
    setGithubModalOpen,
    current,
    edits,
    baseKey,
    loadRemoteMarkdownFiles,
  } = useApp()

  const [activeTab, setActiveTab] = useState<TabKey>('auth')
  const [tokenInput, setTokenInput] = useState(ghToken)
  const [isVerifying, setIsVerifying] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [customRepo, setCustomRepo] = useState('')

  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState(remoteRepo?.branch ?? '')
  const [isPulling, setIsPulling] = useState(false)
  const [inspectedFiles, setInspectedFiles] = useState<string[] | null>(null)
  const [isLoadingInspect, setIsLoadingInspect] = useState(false)

  const [deliveryMode, setDeliveryMode] = useState<'commit' | 'pr'>('commit')
  const [targetBranch, setTargetBranch] = useState(remoteRepo?.branch ?? 'main')
  const [commitMessage, setCommitMessage] = useState('')
  const [prTitle, setPrTitle] = useState('')
  const [prBranch, setPrBranch] = useState('')
  const [isPushing, setIsPushing] = useState(false)
  const [pushStatus, setPushStatus] = useState<{ success: boolean; text: string; url?: string } | null>(null)

  const tokenInputId = useId()
  const customRepoId = useId()
  const branchSelectId = useId()
  const targetBranchId = useId()
  const commitMessageId = useId()
  const prTitleId = useId()
  const prBranchId = useId()

  useEffect(() => {
    setTokenInput(ghToken)
  }, [ghToken])

  useEffect(() => {
    if (remoteRepo?.branch) {
      setSelectedBranch(remoteRepo.branch)
      setTargetBranch(remoteRepo.branch)
    }
  }, [remoteRepo])

  useEffect(() => {
    if (current) {
      setCommitMessage(`docs: update ${current.file} via repoDocs`)
      setPrTitle(`docs: update ${current.file}`)
      setPrBranch(`docs-update-${Date.now().toString(36)}`)
    }
  }, [current])

  const fetchUserRepos = useCallback(async (token: string) => {
    setIsLoadingRepos(true)
    try {
      const userRepos = await listUserRepos(token)
      setRepos(userRepos)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error fetching repositories')
    } finally {
      setIsLoadingRepos(false)
    }
  }, [])

  const handleConnectToken = async () => {
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    setIsVerifying(true)
    setAuthError(null)
    try {
      const user = await validateGitHubToken(trimmed)
      setGhUser(user)
      setGhToken(trimmed)
      await fetchUserRepos(trimmed)
      toast(`${t('github.connectedAs')} ${user.login}`)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to authenticate token')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDisconnect = () => {
    setGhToken('')
    setGhUser(null)
    setRemoteRepo(null)
    setRepos([])
    setBranches([])
    setTokenInput('')
    setAuthError(null)
  }

  const handleSelectRepo = (owner: string, repo: string, defaultBranch = 'main') => {
    const nextRepo = { owner, repo, branch: defaultBranch }
    setRemoteRepo(nextRepo)
    setSelectedBranch(defaultBranch)
    setTargetBranch(defaultBranch)
    toast(`${t('github.repos.selected')}: ${owner}/${repo}`)
    setActiveTab('pull')
  }

  const handleLoadCustomRepo = () => {
    const trimmed = customRepo.trim()
    const parts = trimmed.split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setAuthError('Please enter owner/repo (e.g. facebook/react)')
      return
    }
    handleSelectRepo(parts[0], parts[1], 'main')
  }

  const fetchBranches = useCallback(async () => {
    if (!ghToken || !remoteRepo) return
    setIsLoadingBranches(true)
    try {
      const branchList = await listRepoBranches(ghToken, remoteRepo.owner, remoteRepo.repo)
      setBranches(branchList)
      if (branchList.length > 0 && !branchList.some((b) => b.name === selectedBranch)) {
        setSelectedBranch(branchList[0].name)
        setTargetBranch(branchList[0].name)
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error loading branches')
    } finally {
      setIsLoadingBranches(false)
    }
  }, [ghToken, remoteRepo, selectedBranch])

  useEffect(() => {
    if (githubModalOpen && ghToken && remoteRepo && activeTab !== 'auth') {
      void fetchBranches()
    }
  }, [githubModalOpen, ghToken, remoteRepo, activeTab, fetchBranches])

  const handleInspectFiles = async () => {
    if (!ghToken || !remoteRepo) return
    setIsLoadingInspect(true)
    setInspectedFiles(null)
    try {
      const branchToUse = selectedBranch || remoteRepo.branch
      const pulled = await pullRepoMarkdownFiles(ghToken, remoteRepo.owner, remoteRepo.repo, branchToUse)
      setInspectedFiles(pulled.map((f) => f.path))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error inspecting branch files')
    } finally {
      setIsLoadingInspect(false)
    }
  }

  const handlePullFiles = async () => {
    if (!ghToken || !remoteRepo) return
    setIsPulling(true)
    try {
      const branchToUse = selectedBranch || remoteRepo.branch
      const pulled = await pullRepoMarkdownFiles(ghToken, remoteRepo.owner, remoteRepo.repo, branchToUse)
      if (pulled.length === 0) {
        toast(t('github.pull.noFiles'))
        return
      }
      setRemoteRepo({ owner: remoteRepo.owner, repo: remoteRepo.repo, branch: branchToUse })
      loadRemoteMarkdownFiles(remoteRepo.repo, pulled)
      void syncPulledFilesToLocalServer(remoteRepo.repo, branchToUse, pulled)
      toast(t('github.pull.success', { count: pulled.length, repo: remoteRepo.repo, branch: branchToUse }))
      setGithubModalOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error pulling files')
    } finally {
      setIsPulling(false)
    }
  }

  const handlePush = async () => {
    if (!ghToken || !remoteRepo || !current) return
    setIsPushing(true)
    setPushStatus(null)

    try {
      const safePath = sanitizeRepoFilePath(current.file)
      const rawContent = assembleRaw(current, edits, baseKey)

      if (deliveryMode === 'commit') {
        const result = await pushCommitToBranch(ghToken, {
          owner: remoteRepo.owner,
          repo: remoteRepo.repo,
          branch: targetBranch || remoteRepo.branch,
          path: safePath,
          content: rawContent,
          message: commitMessage || `docs: update ${current.file}`,
        })
        if (!result.ok) {
          throw new Error(result.error || 'Failed to push commit')
        }
        setPushStatus({
          success: true,
          text: t('github.push.success.commit'),
          url: result.commitUrl,
        })
        toast(t('github.push.success.commit'))
      } else {
        const prRes = await pushToPullRequest(ghToken, {
          owner: remoteRepo.owner,
          repo: remoteRepo.repo,
          baseBranch: targetBranch || remoteRepo.branch,
          prBranch: prBranch.trim() || `update-${Date.now().toString(36)}`,
          path: safePath,
          content: rawContent,
          message: commitMessage || `docs: update ${current.file}`,
          prTitle: prTitle.trim() || `docs: update ${current.file}`,
          prBody: `Automated document sync via repoDocs for \`${current.file}\`.`,
        })
        if (!prRes.ok) {
          throw new Error(prRes.error || 'Failed to create pull request')
        }
        setPushStatus({
          success: true,
          text: `${t('github.push.success.pr')} (#${prRes.prNumber})`,
          url: prRes.prUrl,
        })
        toast(t('github.push.success.pr'))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed'
      setPushStatus({ success: false, text: msg })
      toast(msg)
    } finally {
      setIsPushing(false)
    }
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGithubModalOpen(false)
    }
    if (githubModalOpen) {
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }
  }, [githubModalOpen, setGithubModalOpen])

  if (!githubModalOpen) return null

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  )

  return (
    <div className="github-modal-backdrop" onClick={() => setGithubModalOpen(false)}>
      <div
        className="github-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gh-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="github-modal-header">
          <div className="github-modal-title-wrap">
            <svg className="github-icon-lg" viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <h2 id="gh-modal-title">{t('github.modal.title')}</h2>
          </div>
          <button
            type="button"
            className="github-modal-close"
            onClick={() => setGithubModalOpen(false)}
            aria-label="Close modal"
          >
            ✕
          </button>
        </header>

        <nav className="github-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'auth'}
            className={`github-tab-btn${activeTab === 'auth' ? ' active' : ''}`}
            onClick={() => setActiveTab('auth')}
          >
            {t('github.tab.auth')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pull'}
            className={`github-tab-btn${activeTab === 'pull' ? ' active' : ''}`}
            onClick={() => setActiveTab('pull')}
          >
            {t('github.tab.pull')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'push'}
            className={`github-tab-btn${activeTab === 'push' ? ' active' : ''}`}
            onClick={() => setActiveTab('push')}
          >
            {t('github.tab.push')}
          </button>
        </nav>

        <div className="github-modal-body">
          {activeTab === 'auth' && (
            <div className="github-auth-pane">
              <div className="github-form-group">
                <label htmlFor={tokenInputId}>{t('github.token.label')}</label>
                <div className="github-input-row">
                  <input
                    id={tokenInputId}
                    type="password"
                    className="github-text-input"
                    placeholder={t('github.token.placeholder')}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn primary sm"
                    onClick={() => void handleConnectToken()}
                    disabled={isVerifying || !tokenInput.trim()}
                  >
                    {isVerifying ? '…' : t('github.connect')}
                  </button>
                  {ghUser && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={handleDisconnect}
                    >
                      {t('github.disconnect')}
                    </button>
                  )}
                </div>
                <div className="github-token-meta">
                  <span className="github-help-text">{t('github.token.help')}</span>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=repoDocs%20Integration"
                    target="_blank"
                    rel="noreferrer"
                    className="github-external-link"
                  >
                    {t('github.token.createLink')}
                  </a>
                </div>
                {authError && <div className="github-error-box">{authError}</div>}
              </div>

              {ghUser && (
                <div className="github-user-card">
                  <img src={ghUser.avatar_url} alt={ghUser.login} className="github-avatar" />
                  <div className="github-user-info">
                    <strong>{ghUser.name || ghUser.login}</strong>
                    <span>@{ghUser.login}</span>
                  </div>
                  {remoteRepo && (
                    <div className="github-active-repo-badge">
                      <span>{remoteRepo.owner}/{remoteRepo.repo}</span>
                    </div>
                  )}
                </div>
              )}

              {ghUser && (
                <div className="github-repos-section">
                  <div className="github-section-header">
                    <h3>{t('github.repos.title')}</h3>
                    <input
                      type="search"
                      className="github-search-input"
                      placeholder={t('github.repos.search')}
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                    />
                  </div>

                  {isLoadingRepos ? (
                    <div className="github-loading">Loading repositories…</div>
                  ) : (
                    <div className="github-repo-list">
                      {filteredRepos.map((r) => {
                        const isSelected = remoteRepo?.owner === r.owner.login && remoteRepo?.repo === r.name
                        return (
                          <div
                            key={r.id}
                            className={`github-repo-item${isSelected ? ' selected' : ''}`}
                            onClick={() => handleSelectRepo(r.owner.login, r.name, r.default_branch)}
                          >
                            <div className="github-repo-item-main">
                              <span className="github-repo-name">{r.full_name}</span>
                              {r.description && <span className="github-repo-desc">{r.description}</span>}
                            </div>
                            <button
                              type="button"
                              className={`btn sm ${isSelected ? 'primary' : 'ghost'}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectRepo(r.owner.login, r.name, r.default_branch)
                              }}
                            >
                              {isSelected ? t('github.repos.selected') : t('github.repos.select')}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="github-custom-repo-row">
                    <label htmlFor={customRepoId}>{t('github.repos.custom')}</label>
                    <div className="github-input-row">
                      <input
                        id={customRepoId}
                        type="text"
                        className="github-text-input"
                        placeholder="owner/repository"
                        value={customRepo}
                        onChange={(e) => setCustomRepo(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={handleLoadCustomRepo}
                        disabled={!customRepo.trim()}
                      >
                        {t('github.repos.load')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pull' && (
            <div className="github-pull-pane">
              {!remoteRepo ? (
                <div className="github-pane-empty">
                  <p>No repository selected. Please connect your token and select a repository first.</p>
                  <button type="button" className="btn primary sm" onClick={() => setActiveTab('auth')}>
                    {t('github.tab.auth')}
                  </button>
                </div>
              ) : (
                <div className="github-pull-form">
                  <div className="github-repo-header-badge">
                    <span className="badge-label">{t('github.repos.selected')}:</span>
                    <span className="badge-value">{remoteRepo.owner}/{remoteRepo.repo}</span>
                  </div>

                  <div className="github-form-group">
                    <label htmlFor={branchSelectId}>{t('github.branch.label')}</label>
                    <div className="github-input-row">
                      <select
                        id={branchSelectId}
                        className="github-select"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={isLoadingBranches}
                      >
                        {branches.map((b) => (
                          <option key={b.name} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => void fetchBranches()}
                        disabled={isLoadingBranches}
                        title={t('github.branch.refresh')}
                      >
                        {isLoadingBranches ? '…' : '↻'}
                      </button>
                    </div>
                  </div>

                  <div className="github-action-row">
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => void handleInspectFiles()}
                      disabled={isLoadingInspect || isPulling}
                    >
                      {isLoadingInspect ? '…' : t('github.pull.inspect')}
                    </button>
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={() => void handlePullFiles()}
                      disabled={isPulling}
                    >
                      {isPulling ? t('github.pull.pulling') : t('github.pull.button')}
                    </button>
                  </div>

                  {inspectedFiles && (
                    <div className="github-inspected-box">
                      <div className="github-inspected-title">
                        {t('github.pull.filesFound', { count: inspectedFiles.length, branch: selectedBranch })}
                      </div>
                      {inspectedFiles.length === 0 ? (
                        <div className="github-empty-notice">{t('github.pull.noFiles')}</div>
                      ) : (
                        <ul className="github-files-list">
                          {inspectedFiles.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className="github-security-banner">
                    {t('github.security.note')}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'push' && (
            <div className="github-push-pane">
              {!current ? (
                <div className="github-pane-empty">
                  <p>No document is currently active.</p>
                </div>
              ) : !remoteRepo ? (
                <div className="github-pane-empty">
                  <p>No remote repository selected.</p>
                  <button type="button" className="btn primary sm" onClick={() => setActiveTab('auth')}>
                    {t('github.tab.auth')}
                  </button>
                </div>
              ) : (
                <div className="github-push-form">
                  <div className="github-meta-grid">
                    <div className="github-meta-item">
                      <span className="meta-label">{t('github.push.doc')}</span>
                      <span className="meta-value">{current.file}</span>
                    </div>
                    <div className="github-meta-item">
                      <span className="meta-label">{t('github.push.repo')}</span>
                      <span className="meta-value">{remoteRepo.owner}/{remoteRepo.repo}</span>
                    </div>
                  </div>

                  <div className="github-form-group">
                    <label>{t('github.push.mode')}</label>
                    <div className="github-radio-group">
                      <label className="github-radio-label">
                        <input
                          type="radio"
                          name="deliveryMode"
                          value="commit"
                          checked={deliveryMode === 'commit'}
                          onChange={() => setDeliveryMode('commit')}
                        />
                        {t('github.push.mode.commit')}
                      </label>
                      <label className="github-radio-label">
                        <input
                          type="radio"
                          name="deliveryMode"
                          value="pr"
                          checked={deliveryMode === 'pr'}
                          onChange={() => setDeliveryMode('pr')}
                        />
                        {t('github.push.mode.pr')}
                      </label>
                    </div>
                  </div>

                  <div className="github-form-group">
                    <label htmlFor={targetBranchId}>{t('github.push.branch')}</label>
                    <input
                      id={targetBranchId}
                      type="text"
                      className="github-text-input"
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                    />
                  </div>

                  {deliveryMode === 'pr' && (
                    <>
                      <div className="github-form-group">
                        <label htmlFor={prTitleId}>{t('github.push.prTitle.label')}</label>
                        <input
                          id={prTitleId}
                          type="text"
                          className="github-text-input"
                          value={prTitle}
                          onChange={(e) => setPrTitle(e.target.value)}
                        />
                      </div>
                      <div className="github-form-group">
                        <label htmlFor={prBranchId}>{t('github.push.prBranch.label')}</label>
                        <input
                          id={prBranchId}
                          type="text"
                          className="github-text-input"
                          value={prBranch}
                          onChange={(e) => setPrBranch(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="github-form-group">
                    <label htmlFor={commitMessageId}>{t('github.push.message.label')}</label>
                    <textarea
                      id={commitMessageId}
                      className="github-textarea"
                      rows={3}
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder={t('github.push.message.placeholder')}
                    />
                  </div>

                  <div className="github-action-row">
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={() => void handlePush()}
                      disabled={isPushing || !commitMessage.trim()}
                    >
                      {isPushing
                        ? t('github.push.pushing')
                        : deliveryMode === 'commit'
                          ? t('github.push.button.commit')
                          : t('github.push.button.pr')}
                    </button>
                  </div>

                  {pushStatus && (
                    <div className={`github-status-box ${pushStatus.success ? 'success' : 'error'}`}>
                      <div>{pushStatus.text}</div>
                      {pushStatus.url && (
                        <a
                          href={pushStatus.url}
                          target="_blank"
                          rel="noreferrer"
                          className="github-external-link"
                        >
                          View on GitHub ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
