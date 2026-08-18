# AGENTS.md

Guía de entrada para agentes de código. La fuente operativa completa es `CLAUDE.md` (misma carpeta): stack, reglas no negociables, comandos, estructura y convenciones. Léelo antes de tocar código.

## Skills del proyecto

Las skills compartidas viven en `.agents/skills/`; son parte de Zulu, no de la configuración personal de un agente. Antes de actuar, lee completo el `SKILL.md` que el usuario nombre o cuya descripción coincida con la tarea.

- `ponytail`: usar en cualquier tarea de código para buscar la solución mínima correcta.
- `thermo-nuclear-code-quality-review`: usar solo cuando el usuario pida explícitamente una revisión termo-nuclear, una auditoría profunda o una revisión especialmente estricta.

Si el host no descubre `.agents/skills/` automáticamente, consulta esas rutas de forma manual. No dependas de una instalación global en Codex, Claude, Cursor, Grok u otro host.

Reglas mínimas si solo lees este archivo:

- **Alcance de build:** `docs/pilot-scope-v0.3.1.md` (con su nota de erratas) es la única autoridad. `docs/srs-v0.2.md` es visión, no alcance. `docs/archive/` es historia.
- **Plan de trabajo:** `ROADMAP.md`. Toma la primera tarea sin marcar de la fase más temprana disponible; marca el checkbox al cerrarla. La Fase 3 no empieza sin los spikes de Fase 1 verdes.
- **Hay menores de edad (desde 15 años):** minimización de datos, sin raw provider response, sin flujos de salvaguarda improvisados.
- **No reintroducir lo descartado:** NextAuth, streaming del proveedor, Drizzle como dueño de esquema, RAG manual/pgvector, delimitadores `<documento>`, citas cruzadas por título, score/confianza en el contrato del modelo, ni el formulario de motivo para el acceso admin a conversaciones (decisión 2026-07-17: acceso directo con log silencioso).
- **Ningún `next/link` dentro de `/admin`:** todo el panel navega con `<a>` porque audita al renderizar en servidor; una navegación SPA permitiría reabrir la ruta desde la caché de cliente sin dejar fila de auditoría. El porqué completo está en `CLAUDE.md` y en el handoff del `ROADMAP.md`.
- **Un fallo de consulta no es ausencia de datos:** si Supabase devuelve error, muestra un aviso; nunca una lista vacía, un 404 ni una transcripción incompleta. Y pagina con `count` exacto lo que pueda crecer: PostgREST corta en `db-max-rows` sin avisar.
- **Commits:** en español, sin `Co-Authored-By`. No pushear sin confirmación.
- **Secretos:** Gemini y Supabase service role solo en servidor. La service role salta la RLS; el camino del chat usa el JWT del usuario.
