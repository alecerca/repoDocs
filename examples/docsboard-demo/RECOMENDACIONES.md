# Recomendaciones · proyecto de ejemplo

> Documento vivo de ejemplo con estados: ✅ Completada · 📌 Pendiente · 🔶 En progreso

---

## Resumen de estado

| # | Tema | Estado |
|---|------|--------|
| 1 | Refactor del generador de docs | 🔶 En progreso |
| 2 | Export byte-idéntico sin ediciones | ✅ Completada |
| 3 | Smoke test E2E automático | ✅ Completada |

---

## A. Calidad

### 1. Refactor del generador de docs — 🔶 En progreso

**Contexto:** `sync-docs.mjs` crecía con lógica de negocio hardcodeada.

**Propuesta:** mover root, emojis de estado y marcas a `mdboard.json` y generar `src/generated/appconfig.ts` para el front-end.

---

## B. Fidelidad del export — ✅ Completada

Sin ediciones, el markdown exportado debe ser byte-idéntico al archivo original. Se eliminaron los `trimEnd()` del generador y la normalización de saltos de línea en `assembleRaw`.

---

## C. Verificación — ✅ Completada

`scripts/smoke.mjs` (Playwright) cubre navegación, edición, export con tabla resumen, reset y preview de app. Corre sin errores de consola.

---