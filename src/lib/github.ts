/**
 * GitHub API client and repository synchronization library for repoDocs.
 * Provides remote repository discovery, branch markdown pulling, and commit/PR pushing.
 */

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    avatar_url: string
  }
  private: boolean
  description: string | null
  default_branch: string
  updated_at: string
  html_url: string
}

export interface GitHubBranch {
  name: string
  commit: {
    sha: string
  }
  protected: boolean
}

export interface GitHubFile {
  path: string
  content: string
  sha?: string
  size?: number
}

export interface PushCommitOptions {
  owner: string
  repo: string
  branch: string
  path: string
  content: string
  message: string
  sha?: string
}

export interface PushPrOptions {
  owner: string
  repo: string
  baseBranch: string
  prBranch: string
  path: string
  content: string
  message: string
  prTitle: string
  prBody?: string
  sha?: string
}

export interface CommitResult {
  ok: boolean
  commitSha?: string
  commitUrl?: string
  error?: string
}

export interface PrResult {
  ok: boolean
  prNumber?: number
  prUrl?: string
  error?: string
}

/**
 * Validates and sanitizes a relative file path within a repository.
 * Rejects absolute paths, directory traversal sequences, and non-markdown files.
 *
 * @param filePath Relative path inside repository
 * @returns Cleaned normalized relative path
 */
export function sanitizeRepoFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path')
  }
  const clean = filePath.replace(/\\/g, '/').trim()
  if (clean.startsWith('/') || /^[a-zA-Z]:/.test(clean)) {
    throw new Error('Absolute paths are not allowed')
  }
  const segments = clean.split('/')
  for (const seg of segments) {
    if (seg === '..' || seg === '.' || seg === '') {
      throw new Error('Path traversal sequence detected in file path')
    }
  }
  if (!clean.toLowerCase().endsWith('.md')) {
    throw new Error('Only .md files are supported')
  }
  return clean
}

/**
 * Sanitizes a repository name into a safe local directory name.
 *
 * @param repoName Raw repository name
 * @returns Safe directory name without path separators
 */
export function sanitizeRepoName(repoName: string): string {
  if (!repoName || typeof repoName !== 'string') {
    throw new Error('Invalid repository name')
  }
  const nameOnly = repoName.includes('/') ? repoName.split('/').slice(-1)[0] : repoName
  const safe = nameOnly.trim().replace(/[^a-zA-Z0-9._-]/g, '_')
  if (!safe || safe === '.' || safe === '..' || safe.startsWith('_')) {
    throw new Error('Unsafe repository name')
  }
  return safe
}

/**
 * Decodes base64 string to utf-8 text safely across browsers and node.
 *
 * @param base64 Input base64 string
 * @returns Decoded UTF-8 string
 */
export function decodeBase64Utf8(base64: string): string {
  const clean = base64.replace(/\s/g, '')
  const binaryString = atob(clean)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Encodes utf-8 text into base64 safely across browsers and node.
 *
 * @param text Input text
 * @returns Base64 representation
 */
export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Validates a GitHub Personal Access Token by retrieving authenticated user profile.
 *
 * @param token GitHub Personal Access Token
 * @returns Profile of the authenticated user
 */
export async function validateGitHubToken(token: string): Promise<GitHubUser> {
  const cleanToken = token.trim()
  if (!cleanToken) {
    throw new Error('Token is required')
  }
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${cleanToken}`,
    },
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    const msg = errorBody?.message || `GitHub API error: ${res.status}`
    throw new Error(msg)
  }
  const data = (await res.json()) as GitHubUser
  return {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
    html_url: data.html_url,
  }
}

/**
 * Lists repositories accessible to the user, ordered by recent update.
 *
 * @param token GitHub Personal Access Token
 * @returns List of repositories
 */
export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  const cleanToken = token.trim()
  const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${cleanToken}`,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message || `Failed to list repositories: ${res.status}`)
  }
  return (await res.json()) as GitHubRepo[]
}

/**
 * Retrieves repository details for an owner/repo pair.
 *
 * @param token GitHub Personal Access Token (optional for public repos)
 * @param owner Repository owner
 * @param repo Repository name
 * @returns Repository metadata
 */
export async function getRepoInfo(token: string, owner: string, repo: string): Promise<GitHubRepo> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`
  }
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message || `Repository ${owner}/${repo} not found: ${res.status}`)
  }
  return (await res.json()) as GitHubRepo
}

/**
 * Lists branches for a repository.
 *
 * @param token GitHub Personal Access Token
 * @param owner Repository owner
 * @param repo Repository name
 * @returns List of repository branches
 */
export async function listRepoBranches(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`
  }
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.message || `Failed to list branches: ${res.status}`)
  }
  return (await res.json()) as GitHubBranch[]
}

/**
 * Pulls all markdown (.md) files from a branch of a remote GitHub repository.
 * Enforces strict containment to ensure paths do not escape repository root.
 *
 * @param token GitHub Personal Access Token
 * @param owner Repository owner
 * @param repo Repository name
 * @param branch Branch name
 * @returns Array of pulled markdown files with content
 */
export async function pullRepoMarkdownFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubFile[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers }
  )
  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => null)
    throw new Error(err?.message || `Failed to fetch repository tree: ${treeRes.status}`)
  }

  const treeData = (await treeRes.json()) as {
    tree: Array<{ path: string; type: string; sha: string; size?: number }>
  }

  const mdEntries = treeData.tree.filter(
    (item) => item.type === 'blob' && /\.md$/i.test(item.path)
  )

  const files: GitHubFile[] = []

  for (const item of mdEntries) {
    const safePath = sanitizeRepoFilePath(item.path)
    const fileRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(safePath)}?ref=${encodeURIComponent(branch)}`,
      { headers }
    )
    if (!fileRes.ok) {
      continue
    }
    const fileData = (await fileRes.json()) as { content?: string; encoding?: string; sha?: string }
    if (!fileData.content) {
      continue
    }
    const decoded = decodeBase64Utf8(fileData.content)
    files.push({
      path: safePath,
      content: decoded,
      sha: fileData.sha || item.sha,
      size: item.size,
    })
  }

  return files
}

/**
 * Pushes a commit directly to a remote GitHub branch with an editable commit message.
 *
 * @param token GitHub Personal Access Token
 * @param options Push commit configuration
 * @returns Result including commit SHA and URL
 */
export async function pushCommitToBranch(
  token: string,
  options: PushCommitOptions
): Promise<CommitResult> {
  const cleanToken = token.trim()
  if (!cleanToken) {
    return { ok: false, error: 'Authentication token is required to commit' }
  }

  const safePath = sanitizeRepoFilePath(options.path)
  const commitMsg = options.message?.trim() || `docs: update ${safePath} via repoDocs`

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${cleanToken}`,
    'Content-Type': 'application/json',
  }

  let fileSha = options.sha
  if (!fileSha) {
    const getRes = await fetch(
      `https://api.github.com/repos/${options.owner}/${options.repo}/contents/${encodeURI(safePath)}?ref=${encodeURIComponent(options.branch)}`,
      { headers: { Accept: 'application/vnd.github.v3+json', Authorization: `Bearer ${cleanToken}` } }
    )
    if (getRes.ok) {
      const data = (await getRes.json()) as { sha?: string }
      fileSha = data.sha
    }
  }

  const payload: Record<string, unknown> = {
    message: commitMsg,
    content: encodeBase64Utf8(options.content),
    branch: options.branch,
  }
  if (fileSha) {
    payload.sha = fileSha
  }

  const putRes = await fetch(
    `https://api.github.com/repos/${options.owner}/${options.repo}/contents/${encodeURI(safePath)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    }
  )

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => null)
    return {
      ok: false,
      error: err?.message || `Failed to create commit: ${putRes.status}`,
    }
  }

  const resData = (await putRes.json()) as {
    commit?: { sha?: string; html_url?: string }
  }

  return {
    ok: true,
    commitSha: resData.commit?.sha,
    commitUrl: resData.commit?.html_url,
  }
}

/**
 * Creates a new branch from a base branch, commits the document changes,
 * and opens a Pull Request on GitHub with custom title and editable message.
 *
 * @param token GitHub Personal Access Token
 * @param options Pull Request configuration
 * @returns Result including PR number and URL
 */
export async function pushToPullRequest(
  token: string,
  options: PushPrOptions
): Promise<PrResult> {
  const cleanToken = token.trim()
  if (!cleanToken) {
    return { ok: false, error: 'Authentication token is required' }
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${cleanToken}`,
    'Content-Type': 'application/json',
  }

  const baseRefRes = await fetch(
    `https://api.github.com/repos/${options.owner}/${options.repo}/git/ref/heads/${encodeURIComponent(options.baseBranch)}`,
    { headers }
  )
  if (!baseRefRes.ok) {
    const err = await baseRefRes.json().catch(() => null)
    return { ok: false, error: err?.message || `Failed to get base branch reference` }
  }
  const baseRefData = (await baseRefRes.json()) as { object?: { sha?: string } }
  const baseSha = baseRefData.object?.sha
  if (!baseSha) {
    return { ok: false, error: 'Could not resolve base branch SHA' }
  }

  const createRefRes = await fetch(
    `https://api.github.com/repos/${options.owner}/${options.repo}/git/refs`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${options.prBranch}`,
        sha: baseSha,
      }),
    }
  )
  if (!createRefRes.ok && createRefRes.status !== 422) {
    const err = await createRefRes.json().catch(() => null)
    return { ok: false, error: err?.message || `Failed to create branch ${options.prBranch}` }
  }

  const commitRes = await pushCommitToBranch(cleanToken, {
    owner: options.owner,
    repo: options.repo,
    branch: options.prBranch,
    path: options.path,
    content: options.content,
    message: options.message,
    sha: options.sha,
  })
  if (!commitRes.ok) {
    return { ok: false, error: commitRes.error || 'Failed to commit to PR branch' }
  }

  const prRes = await fetch(
    `https://api.github.com/repos/${options.owner}/${options.repo}/pulls`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: options.prTitle,
        head: options.prBranch,
        base: options.baseBranch,
        body: options.prBody || 'Markdown document updated via repoDocs.',
      }),
    }
  )

  if (!prRes.ok) {
    const err = await prRes.json().catch(() => null)
    return { ok: false, error: err?.message || `Failed to create Pull Request: ${prRes.status}` }
  }

  const prData = (await prRes.json()) as { number?: number; html_url?: string }
  return {
    ok: true,
    prNumber: prData.number,
    prUrl: prData.html_url,
  }
}

/**
 * Sends pulled files to the local Vite dev/preview server to persist them in projectsRoot.
 *
 * @param repoName Repository name for local directory
 * @param branch Pulled branch name
 * @param files Array of markdown files
 * @returns Server response status
 */
export async function syncPulledFilesToLocalServer(
  repoName: string,
  branch: string,
  files: GitHubFile[]
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch('/__mdboard/github/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: repoName,
        branch,
        files: files.map((f) => ({ path: f.path, content: f.content })),
      }),
    })
    const data = (await res.json()) as { ok?: boolean; count?: number; error?: string }
    return {
      ok: res.ok && data.ok === true,
      count: data.count,
      error: data.error,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
