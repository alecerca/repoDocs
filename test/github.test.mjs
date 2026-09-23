import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeRepoFilePath,
  sanitizeRepoName,
  encodeBase64Utf8,
  decodeBase64Utf8,
} from '../src/lib/github.ts'
import { parseMarkdownDoc } from '../src/lib/registry.ts'

test('sanitizeRepoFilePath validates safe markdown paths', () => {
  assert.equal(sanitizeRepoFilePath('README.md'), 'README.md')
  assert.equal(sanitizeRepoFilePath('docs/guide.md'), 'docs/guide.md')
  assert.equal(sanitizeRepoFilePath('a/b/c/doc.md'), 'a/b/c/doc.md')
  assert.equal(sanitizeRepoFilePath('path/to/my-notes.MD'), 'path/to/my-notes.MD')
})

test('sanitizeRepoFilePath rejects path traversal attacks', () => {
  assert.throws(() => sanitizeRepoFilePath('../secret.md'), /traversal/)
  assert.throws(() => sanitizeRepoFilePath('foo/../../bar.md'), /traversal/)
  assert.throws(() => sanitizeRepoFilePath('docs/../../../etc/passwd.md'), /traversal/)
})

test('sanitizeRepoFilePath rejects absolute paths', () => {
  assert.throws(() => sanitizeRepoFilePath('/etc/passwd.md'), /Absolute paths/)
  assert.throws(() => sanitizeRepoFilePath('C:\\Windows\\System32\\file.md'), /Absolute paths/)
})

test('sanitizeRepoFilePath rejects non-markdown files', () => {
  assert.throws(() => sanitizeRepoFilePath('package.json'), /Only \.md files/)
  assert.throws(() => sanitizeRepoFilePath('src/main.ts'), /Only \.md files/)
  assert.throws(() => sanitizeRepoFilePath('script.sh'), /Only \.md files/)
})

test('sanitizeRepoName validates safe repo names and rejects invalid names', () => {
  assert.equal(sanitizeRepoName('repoDocs'), 'repoDocs')
  assert.equal(sanitizeRepoName('my-cool_repo.2'), 'my-cool_repo.2')
  assert.equal(sanitizeRepoName('alecerca/repoDocs'), 'repoDocs')

  assert.throws(() => sanitizeRepoName(''), /Invalid repository name/)
  assert.throws(() => sanitizeRepoName('..'), /Unsafe repository name/)
  assert.throws(() => sanitizeRepoName('.'), /Unsafe repository name/)
})

test('encodeBase64Utf8 and decodeBase64Utf8 preserve UTF-8 strings accurately', () => {
  const original = '# Guía de integración en Español\n\nFuncionalidad: á é í ó ú ñ ¿¡ 🚀\n- Item 1\n- Item 2\n'
  const encoded = encodeBase64Utf8(original)
  const decoded = decodeBase64Utf8(encoded)
  assert.equal(decoded, original)
})

test('parseMarkdownDoc decomposes markdown text into structured sections', () => {
  const markdown = `# Main Title\n\nIntroduction paragraph with [link](https://github.com).\n\n## Section One\n\nContent for section one with some details.\n\n## Section Two\n\nMore details in section two.\n`
  const doc = parseMarkdownDoc('remote-repo', 'docs/intro.md', markdown)

  assert.equal(doc.project, 'remote-repo')
  assert.equal(doc.file, 'docs/intro.md')
  assert.equal(doc.title, 'Main Title')
  assert.equal(doc.sections.length, 2)
  assert.equal(doc.sections[0].heading, 'Section One')
  assert.equal(doc.sections[1].heading, 'Section Two')
})

test('parseMarkdownDoc handles documents without H2 headers as single section', () => {
  const markdown = `# Single Header Doc\n\nJust paragraphs of text and notes.\n`
  const doc = parseMarkdownDoc('remote-repo', 'notes.md', markdown)

  assert.equal(doc.title, 'Single Header Doc')
  assert.equal(doc.sections.length, 1)
  assert.equal(doc.sections[0].heading, 'Single Header Doc')
})
