# Agent contributions

## 2026-09-25T20:53:42 - slop agent pass on issue #6

**Issue:** **Contexto:** el parser entiende H1/H2, estados por emoji y tabla resumen.
**Propuesta:** hooks para que cada proyecto inyecte parsers/emitters propios (frontmatter, tablas custom, dialectos).
**Criterio:** plugins en `scripts/plugins/*.mjs` con API documentada; el parser default no cambia. Plugin system: customs importers/exporters

Initial pass by the autonomous slop agent: context recorded, approach documented - ready for a human or follow-up agent to take further.
