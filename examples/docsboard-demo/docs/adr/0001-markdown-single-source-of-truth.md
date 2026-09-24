---
status: accepted
date: 2026-01-12
deciders: [sanchiro]
related_to: [0002]
---

# 0001. Markdown as the single source of truth

## Context

The team keeps project decisions scattered across chat threads and slides. We need a durable
record that lives with the code and is readable by any tool.

## Decision

Store every architecture decision as a plain Markdown file inside the repo, one decision per file,
following the ADR (Architecture Decision Record) format. No database, no proprietary format.

## Consequences

- Decisions are diffable, greppable and versioned with the code.
- No extra tooling is required to read the log (any editor works).
- The board can parse files directly and write back changes losslessly.