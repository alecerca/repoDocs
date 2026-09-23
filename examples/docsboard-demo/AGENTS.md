# DocsBoard — proyecto de ejemplo

> Esto es un `AGENTS.md` de demostración: muestra cómo DocsBoard agrupa por secciones, chips de estado y tabla resumen.

---

## Resumen de estado

| # | Tema | Estado |
|---|------|--------|
| 1 | Configurar DocsBoard con tu repo | 📌 Pendiente |
| 2 | Definir paleta y preview de app | ✅ Completada |
| 3 | Escribir ediciones a los .md reales | ✅ Completada |

---

## A. Primeros pasos — ✅ Completada

Copia `mdboard.json` a la raíz de DocsBoard y ajustá `projectsRoot` para que apunte a la carpeta que contiene tus proyectos (cada uno con su `AGENTS.md` / `RECOMENDACIONES.md`).

### 1. Configuración — 📌 Pendiente

**Contexto:** los proyectos se detectan automáticamente al correr `npm run dev`.

**Propuesta:**
- Poné `projectsRoot` en tu `mdboard.local.json` (no se commitea).
- Ajustá `status` si tus docs usan otros emojis de estado (por defecto `✅` completada, `📌` pendiente, `🔶` en progreso).

---

## B. Personalización — ✅ Completada

Las marcas (`brands`) y previews de app (`apps`) viven en la config; el board no tiene hardcodeado ninguno de tus proyectos.

---
