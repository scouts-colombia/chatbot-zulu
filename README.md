# Zulú

Zulú es un asistente web para consultar documentos oficiales de la Asociación Scouts de Colombia. Responde en español mediante Gemini File Search, valida una salida estructurada en el servidor y muestra citas vinculadas al inventario documental propio.

El piloto admite personas desde los 15 años, una cuota pública configurable antes del registro, historial para cuentas activas y un panel administrativo con auditoría.

## Stack

- Next.js 16, React 19 y TypeScript.
- Supabase Auth y PostgreSQL como fuente de usuarios, conversaciones, mensajes, citas y auditoría.
- Gemini Developer API con `gemini-3.5-flash` y File Search administrado.
- Tailwind CSS, Radix UI y el sistema visual claro de Ruta DNPJ.
- Vercel para previews y producción.

No se usan NextAuth/Auth.js, Neon, AI Gateway, RAG manual, pgvector ni streaming de tokens del proveedor.

## Puesta en marcha local

Requisitos: Node.js compatible con Next.js 16 y `pnpm@10.32.1`.

```bash
pnpm install
pnpm dev
```

Copia `.env.example` como `.env.local` y completa sus valores. Las variables principales son:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`, solo en servidor
- `GUEST_LIMIT_SECRET`, solo en servidor
- `SITE_URL`
- `GEMINI_API_KEY`, solo en servidor
- `GEMINI_MODEL`, fallback si la configuración administrativa no está disponible
- `GEMINI_THINKING_LEVEL`, fallback si la configuración administrativa no está disponible

El proyecto Supabase debe tener habilitados Anonymous Sign-Ins y Manual Linking para el turno público y su conversión a cuenta.

Un administrador puede cambiar modelo, esfuerzo de razonamiento y cuotas desde `/admin/configuracion`. Las claves de Gemini y Supabase permanecen únicamente en variables de entorno.

## Comandos

```bash
pnpm dev        # servidor de desarrollo
pnpm check      # Ultracite/Biome
pnpm test       # pruebas unitarias y de contrato
pnpm typecheck  # TypeScript sin emitir archivos
pnpm build      # compilación de producción
pnpm verify:rls # verificación contra el proyecto Supabase real
```

`pnpm verify:rls` crea usuarios efímeros y escribe en el proyecto configurado. Úsalo solo cuando corresponda y con credenciales de un entorno autorizado.

## Arquitectura y documentación

- [AGENTS.md](AGENTS.md) y [CLAUDE.md](CLAUDE.md): reglas para agentes y decisiones no negociables.
- [docs/pilot-scope-v0.3.1.md](docs/pilot-scope-v0.3.1.md): única autoridad del alcance del piloto.
- [ROADMAP.md](ROADMAP.md): estado, fases y trabajo pendiente.
- [PRODUCT.md](PRODUCT.md) y [DESIGN.md](DESIGN.md): producto y sistema visual.
- [docs/notes/handoff-2026-08-18-personalidad-zulu.md](docs/notes/handoff-2026-08-18-personalidad-zulu.md): entrega operativa más reciente.
- [docs/notes/zulu-visual-system.md](docs/notes/zulu-visual-system.md): biblioteca y uso de la mascota.
- `supabase/migrations/`: fuente única del esquema y la RLS.

`docs/srs-v0.2.md` describe la visión, no el alcance de construcción. `docs/archive/` conserva versiones históricas y no debe guiar implementaciones nuevas.

## Seguridad y privacidad

- Nunca publiques `.env.local`, llaves de Gemini ni la secret key de Supabase.
- La secret key salta la RLS y solo se usa en código de servidor para operaciones que el cliente no puede forjar.
- El camino normal del usuario accede a Supabase con su JWT y queda sujeto a RLS.
- No se guarda la respuesta cruda del proveedor por defecto.
- Hay menores de edad: minimiza datos y no improvises flujos de salvaguarda.

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) antes de crear una rama o PR. Los commits se escriben en español y no se hace push sin confirmación del propietario.
