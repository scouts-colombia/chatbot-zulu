# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Miembros de la Asociación Scouts de Colombia, incluidos adolescentes desde los 15 años, que consultan manuales oficiales para orientar su práctica Scout.
- Personas todavía no registradas que necesitan comprobar el valor de Zulú con una primera pregunta antes de crear una cuenta.
- Administradores autorizados que supervisan usuarios, documentos y conversaciones con auditoría.

## Product Purpose

Zulú es un asistente conversacional para consultar documentos oficiales de la Asociación Scouts de Colombia y recibir respuestas claras, seguras y verificables mediante citas. El éxito significa que una persona encuentra orientación útil con rapidez, entiende de dónde salió y puede continuar su historial al registrarse.

## Positioning

Zulú responde sobre el marco documental oficial de Scouts Colombia mediante Gemini File Search administrado, salida estructurada validada en servidor y citas normalizadas contra el inventario documental propio.

## Operating Context

- Uso web en escritorio y móvil, tanto individual como desde redes compartidas en espacios Scouts.
- Primera visita abierta con una conversación de prueba; al agotar la cuota invitada se exige registro.
- Las cuentas registradas conservan conversaciones, citas y preguntas guiadas.
- Las cuentas del piloto se activan según allowlist o revisión administrativa.

## Capabilities and Constraints

- El límite diario de un invitado se configura desde el panel y empieza en un turno. Usa una sesión anónima de Supabase y una identidad seudónima derivada en servidor; no se guarda IP cruda ni fingerprint reversible.
- La conversación invitada se conserva al crear una cuenta y queda asociada a ella cuando completa registro, consentimiento y activación.
- Usuarios registrados tienen una cuota diaria independiente del turno invitado.
- No se guarda la respuesta cruda del proveedor, no hay streaming del proveedor y no se implementa RAG manual ni caché.
- Hay usuarios menores de edad: minimización de datos, mensajes seguros y ningún flujo de salvaguarda improvisado.
- El panel administrativo mantiene auditoría fail-closed y navegación completa con elementos `a`, no `next/link`.

## Brand Commitments

- El producto se llama **Zulú**.
- Zulú está representado por un búho ilustrado que acompaña la marca y hace legibles los momentos de bienvenida, búsqueda, respuesta y recuperación sin sustituir el contenido escrito.
- La identidad visual debe compartir el mismo lenguaje de Ruta: paleta viva de Scouts Colombia, tipografía, degradados, radios, superficies translúcidas y estándares de interacción del repositorio `D:/dev/ruta-dnpj/ruta`.
- La interfaz y las respuestas se escriben en español.

## Evidence on Hand

- Alcance operativo: `docs/pilot-scope-v0.3.1.md` y sus erratas.
- Plan y decisiones confirmadas: `ROADMAP.md`.
- Sistema visual de referencia: `D:/dev/ruta-dnpj/ruta/app/globals.css`, componentes y activos de `D:/dev/ruta-dnpj/ruta/public/brand` y `public/decor`.
- Activos del búho de Zulú: marca y referencia en `public/images/zulu/`, más la biblioteca de estados transparentes en `public/images/zulu/estados/`. Su catálogo y receta de generación están en `docs/notes/zulu-visual-system.md`.

## Product Principles

- Demostrar utilidad antes de pedir registro.
- Hacer visible el respaldo documental sin abrumar.
- Conservar contexto y borradores al pasar de invitado a cuenta.
- Proteger privacidad y acceso por defecto, especialmente para menores.
- Expresar la energía de Scouts Colombia sin restar claridad al trabajo principal.

## Accessibility & Inclusion

- Objetivos táctiles de al menos 44 px, foco visible, navegación por teclado y contraste WCAG AA.
- Respeto por `prefers-reduced-motion` y diseño responsive desde móvil.
- Lenguaje claro para personas con distintos niveles de familiaridad digital.
