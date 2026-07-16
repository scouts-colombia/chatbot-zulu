# Guía de Contribución

Adoptamos el estándar de **Conventional Commits**, en español y sin línea `Co-Authored-By`.

### Formato

`tipo: descripción en minúsculas`

Si quieres especificar **dónde** ocurrió el cambio (módulo, capa, integración), puedes usar **scope** entre paréntesis:

`tipo(scope): descripción en minúsculas`

El **scope es opcional**: úsalo cuando aporte contexto real; si con el tipo y la descripción ya se entiende, no hace falta.

### Tipos principales

- **feat**: Una nueva funcionalidad (ej. `feat(chat): endpoint POST /chat con guard de cuota diaria`).
- **fix**: Corrección de un error (ej. `fix(citas): leer knowledge_document_id del arreglo customMetadata`).
- **refactor**: Cambios en el código que no añaden funciones ni corrigen errores (ej. `refactor(gemini): extraer normalización de grounding a módulo propio`).
- **chore**: Mantenimiento que no cambia el comportamiento del producto: dependencias, tooling, configuración (ej. `chore(deps): retirar drizzle y nextauth tras la poda`).
- **docs**: Cambios solo en la documentación.
- **style**: Cambios de formato (espacios, comas, etc.) que no afectan la lógica.

### Ejemplos del proyecto

```
feat(db): esquema, rls y verificación del piloto (migraciones 0001-0005)

feat(chat): respuesta estructurada con retry único ante json inválido

feat(citas): normalización desde grounding y persistencia en citations

feat(admin): ver conversación ajena con motivo obligatorio y auditoría

fix(rls): el cliente podía fijar created_at en mensajes

fix(seguridad): bloqueo del proveedor mapeado a bloqueado_por_seguridad

chore(ci): lint + typecheck en push y pull_request

docs: resultado del spike de file search en docs/notes
```

### Cuerpo del mensaje (opcional)

Si el cambio tiene varias partes, deja una **línea en blanco** después del título y usa **viñetas** para detallar.

```
feat(chat): preguntas guiadas con opciones e input libre

- Render de 2-4 opciones como botones bajo la respuesta
- Elegir una opción genera un turno normal por el mismo endpoint
- Persistencia en guided_questions y guided_question_options
```

## Flujo de trabajo

1. **Rama nueva por cambio** desde `master`: `feat/...`, `fix/...`, `docs/...`.
2. **PR contra `master`**. El CI corre lint (`pnpm check`) y typecheck (`tsc --noEmit`); ambos deben quedar en verde.
3. **Revisión de Codex**: responde cada comentario indicando el commit que lo corrige (o la razón técnica si no aplica), y resuelve el hilo. Se puede re-invocar con `@codex review`.
4. **Squash and merge** con título en Conventional Commits. Los mensajes intermedios del PR no van en el squash.

### Verificación local antes del PR

```bash
pnpm check              # lint/format (ultracite/Biome)
pnpm exec tsc --noEmit  # typecheck
node scripts/verify-rls.mjs   # si tocaste esquema, políticas o triggers
```

`verify-rls.mjs` corre contra el proyecto Supabase real con usuarios efímeros y limpieza automática; debe quedar VERDE completo.

### Migraciones

- El SQL de `supabase/migrations/` es el **dueño del esquema**.
- Las migraciones son **append-only**: una migración aplicada nunca se edita; los ajustes van en una nueva.
- Toda migración se aplica al proyecto (MCP de Supabase o CLI) en el mismo PR que la introduce, y se revisan los advisors de seguridad después de aplicarla.

## Reglas de oro

- La primera línea del commit no debe exceder los 72 caracteres.
- **Nunca commitear** `.env.local`, llaves (`sb_secret_`, API keys) ni datos reales de Scouts — hay menores de edad; ver `CLAUDE.md` § privacidad.
- El alcance de build es `docs/pilot-scope-v0.3.1.md` (con sus erratas). La v0.2 es visión, no alcance. No reintroducir lo descartado: NextAuth, streaming del proveedor, RAG manual/pgvector, citas por título, Drizzle como esquema.
- La secret key de Supabase salta la RLS: solo se usa en servidor y solo para lo que el cliente no debe poder forjar.

## Estilo de código

El detalle vive en [CLAUDE.md](CLAUDE.md) y [AGENTS.md](AGENTS.md); en corto:

- **UI y respuestas en español**; el dominio de datos ya está en español (`mensajes`, `citas`, `conversaciones` vía Supabase).
- **Sin comentarios narrativos**: el código se explica con buenos nombres y funciones cortas. Un comentario solo se justifica para un *por qué* no evidente.
- **Una función, una responsabilidad.** Separa lógica de negocio del I/O (Supabase, Gemini) para poder testear unidades aisladas.
- Respeta las capas: cliente Supabase con JWT del usuario para lo propio; secret key solo en servidor; Gemini únicamente por la Developer API.

---

Esta guía es una ayuda para todos: un historial claro nos ahorra tiempo a nosotros y le deja el camino ordenado a quien llegue después. De antemano te agradezco por cuidar los detalles.

att: Milo ☕
