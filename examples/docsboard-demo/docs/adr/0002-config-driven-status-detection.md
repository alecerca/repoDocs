---
status: accepted
date: 2026-01-15
deciders: [sanchiro]
depends_on: [0001]
---

# 0002. Config-driven status detection via emojis

## Context

Documents use loose conventions for marking status (✅ done, 📌 pending, 🔶 in progress). Hard-coding
a single convention would break on real-world docs written by different teams.

## Decision

Status keys, emojis, labels and match hints are declared in configuration (`status[]` in the
mdboard config) and compiled into detection patterns per project.

## Consequences

- Detection stays tolerant: emojis plus free-text hints, case-insensitive.
- Labels can be re-defined per project and per document without touching the code.
- New teams can onboard by only editing config, not the parser.