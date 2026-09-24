---
status: accepted
date: 2026-02-02
deciders: [sanchiro]
supersedes: [0002]
---

# 0003. Frontmatter-first status resolution

## Context

Config-only status detection becomes ambiguous when a document uses an emoji for something else
(for example a warning ⚠️ in prose). Explicit metadata is more reliable.

## Decision

Status can be fixed per document in front-matter (`status: accepted`). The resolution cascade is
global config → project → document config → front-matter, with front-matter winning.

## Consequences

- Ambiguity is removed for the documents that care enough to declare their status.
- Old detection still works for docs without front-matter (backwards compatible).
- ADR records reuse the same cascade, so a superseded decision is always explicit.