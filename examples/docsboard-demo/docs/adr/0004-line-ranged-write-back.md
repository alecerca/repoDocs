---
status: accepted
date: 2026-02-10
deciders: [sanchiro]
depends_on: [0003]
---

# 0004. Line-ranged write-back for lossless edits

## Context

Documents are sliced into sections with a range of lines. When a user edits one section, the whole
file must be rebuilt without clobbering front-matter, separators or untouched sections.

## Decision

Keep a per-section line-range registry. On export, apply edits bottom-up as line-range
replacements over the original text, so unmodified sections stay byte-identical.

## Consequences

- Exports are byte-identical when nothing was edited (great for CI diffing).
- Editing never rewrites front-matter unless the user edits that exact range.
- The same mechanism powers both generic docs and ADR records.