---
status: deprecated
date: 2026-01-08
deciders: [sanchiro]
related_to: [0005]
---

# 0006. Offline-first architecture

## Context

Version 0.1 prototypes assumed the app could be served and used entirely offline from a local
Vite process, with no network calls for the core flow.

## Decision

Keep the core read/render path fully offline (local validation, no telemetry). Write-back is the
only network-opting feature, and it is opt-in behind a server middleware.

## Consequences

- Strong privacy story for devs; the app works on a disconnected laptop.
- Superseded in spirit by 0005: new UX features are allowed to be richer, as long as the core
  remains offline-capable.