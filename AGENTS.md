# AGENTS.md

Guía de entrada para agentes de código. La fuente operativa completa es `CLAUDE.md` (misma carpeta): stack, reglas no negociables, comandos, estructura y convenciones. Léelo antes de tocar código.

Reglas mínimas si solo lees este archivo:

- **Alcance de build:** `docs/pilot-scope-v0.3.1.md` (con su nota de erratas) es la única autoridad. `docs/srs-v0.2.md` es visión, no alcance. `docs/archive/` es historia.
- **Plan de trabajo:** `ROADMAP.md`. Toma la primera tarea sin marcar de la fase más temprana disponible; marca el checkbox al cerrarla. La Fase 3 no empieza sin los spikes de Fase 1 verdes.
- **Hay menores de edad (desde 15 años):** minimización de datos, sin raw provider response, sin flujos de salvaguarda improvisados.
- **No reintroducir lo descartado:** NextAuth, streaming del proveedor, Drizzle como dueño de esquema, RAG manual/pgvector, delimitadores `<documento>`, citas cruzadas por título, score/confianza en el contrato del modelo.
- **Commits:** en español, sin `Co-Authored-By`. No pushear sin confirmación.
- **Secretos:** Gemini y Supabase service role solo en servidor. La service role salta la RLS; el camino del chat usa el JWT del usuario.
