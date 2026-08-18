# Handoff — personalidad visual de Zulú

- Fecha: 2026-08-18 (America/Bogota)
- Repositorio: `D:\dev\chatbot-zulu`
- Proyecto Supabase: `ddimxdrggrrfcvzwwben`
- Rama local: `agent/zulu-ui-aplicacion`
- Estado: cambios locales sin commit y sin PR abierta

## Estado de las PR anteriores

- La [PR #12](https://github.com/scouts-colombia/chatbot-zulu/pull/12), que habilitó el turno público y el consentimiento, fue mergeada el 2026-08-12.
- La [PR #13](https://github.com/scouts-colombia/chatbot-zulu/pull/13), que aplicó el sistema visual de Ruta, fue mergeada el 2026-08-13.
- La rama local actual todavía es la cabeza histórica de la PR #13. Los cambios de personalidad de Zulú se hicieron después del merge y no pertenecen a una PR publicada.
- `master` local está detrás de `origin/master`. Antes de publicar este trabajo hay que preservar el worktree, sincronizar `master` y crear una rama nueva. No limpiar ni restaurar el worktree: contiene el trabajo vigente.

## Objetivo actual

Dar personalidad visible a Zulú sin cambiar el contrato funcional del chat:

- mostrar la marca junto al nombre;
- usar poses distintas para bienvenida, espera, respuesta y recuperación;
- reemplazar la espera basada únicamente en tres puntos por mensajes breves e indeterminados;
- conservar el texto como fuente completa de significado;
- respetar movimiento reducido, pestañas ocultas y elementos fuera del viewport.

## Cambios locales implementados

### Activos y componente

- `public/images/zulu/zulu-marca.png` y `zulu-saludando.png` quedaron como PNG RGBA con fondo transparente.
- `public/images/zulu/estados/` contiene 21 poses finales, todas con 512 px de alto, canal alfa y esquinas transparentes.
- `components/marca/zulu-mascota.tsx` centraliza las 23 rutas, cinco intensidades de movimiento y la pausa de animaciones fuera del viewport o con la pestaña oculta.
- `components/chat/personalidad-zulu.tsx` aísla la rotación de poses, los mensajes de espera y la preferencia de movimiento reducido para que la lógica principal de la conversación no absorba esa responsabilidad visual.
- Las instancias con movimiento `quieto` no crean observers ni listeners.
- El catálogo, reglas de arte, usos semánticos, movimiento, accesibilidad y prompts reutilizables viven en `docs/notes/zulu-visual-system.md`.

### Integración en la interfaz

- La marca aparece en encabezados del chat público, chat privado y portada de cuenta.
- El estado vacío alterna poses de bienvenida con baja frecuencia.
- La espera rota entre mensajes no secuenciales y poses de búsqueda, lectura, organización y escritura. Con `prefers-reduced-motion` queda estática; con la pestaña oculta no avanza.
- Cada respuesta del asistente muestra una pose acorde con `respondido`, `sin_fuente`, `necesita_aclaracion`, error o conversación archivada.
- El registro desde el límite del turno incorpora una bienvenida visual sin sustituir instrucciones ni validaciones.
- La navegación pública usa etiquetas compactas en móvil y conserva nombres accesibles completos.
- El scroll automático y las animaciones de entrada respetan movimiento reducido.
- El CSS mantiene la sombra estática y anima principalmente `transform` y opacidad.

### Documentación de producto

- `PRODUCT.md`, `DESIGN.md` y `.impeccable/surfaces/app-page-tsx.md` ya reconocen al búho como parte aprobada de la identidad.
- Este handoff sustituye los handoffs del 6 y 12 de agosto.
- `README.md` dejó de describir la plantilla de Vercel y ahora documenta Zulú, su stack y su puesta en marcha.

## Estado operativo de Supabase

- El propietario confirmó que Anonymous Sign-Ins y Manual Linking están habilitados; su ausencia era la causa del fallo al enviar el mensaje de prueba.
- El 2026-08-18 se depuraron las cuentas de Auth y se conservó el UUID del administrador existente para no romper la auditoría.
- Verificación posterior: 1 usuario Auth, 1 perfil `admin` activo, 0 usuarios anónimos y 0 sesiones activas.
- El inicio de sesión con la credencial solicitada se probó correctamente y luego se cerraron globalmente las sesiones.
- Se preservaron 9 eventos de auditoría y 6 documentos de conocimiento. La contraseña no se registra en el repositorio ni en este handoff.

## Verificación realizada

- `pnpm test`: 46/46 pruebas aprobadas. El primer intento dentro del sandbox falló solo por `spawn EPERM`; fuera del sandbox terminó en verde.
- `pnpm typecheck`: sin diagnósticos.
- `pnpm build`: compilación de producción correcta, TypeScript correcto y 18/18 páginas estáticas generadas.
- `pnpm check` completo sigue fallando en Windows por diagnósticos de formato CRLF distribuidos en archivos históricos y de configuración que no pertenecen a esta entrega. El chequeo dirigido sobre los 12 archivos de implementación modificados quedó limpio.
- Auditoría de activos: 23 PNG presentes; las 21 poses del catálogo son RGBA de 512 px de alto y conservan esquinas transparentes.
- Revisión Ponytail: eliminados un SVG embebido redundante y dos maestros PNG sin referencias, cerca de 5,1 MiB en total, sin impacto visual.
- Revisión termonuclear: la lógica de personalidad se extrajo de `conversacion.tsx` a `personalidad-zulu.tsx`; el componente principal bajó de 922 a 790 líneas sin cambiar comportamiento.
- QA visual en navegador colaborativo: escritorio 1280×800 y móvil 375×667 sin desbordes ni regresiones visibles.

## Decisiones que no deben revertirse

- Zulú acompaña; no sustituye estados, mensajes, alertas ni instrucciones.
- Las imágenes son decorativas: `aria-hidden="true"` y `alt=""`.
- No hay streaming del proveedor. La espera visual ocurre mientras el servidor procesa una respuesta completa.
- No convertir las frases de espera en una secuencia falsa de etapas del backend.
- No mostrar ni animar las 21 poses a la vez. Varias son reserva reutilizable.
- No reintroducir modo oscuro, fondo morado, `next-themes` ni variantes `dark:`.
- Dentro de `/admin` se usan enlaces `<a>`, nunca `next/link`.
- No añadir flujos de salvaguarda mediante la mascota.

## Próximos pasos

1. Preservar estos cambios y llevarlos a una rama nueva creada desde `origin/master` actualizado. La PR #13 ya está cerrada.
2. Excluir de cualquier commit `.cursor/mcp.json` y `mcp.json` salvo decisión explícita del propietario.
3. Revisar visualmente escritorio, móvil, viewport corto y `prefers-reduced-motion` con el servidor local existente.
4. Ejecutar la verificación completa y corregir cualquier hallazgo de formato sin reescribir cambios ajenos.
5. Crear un commit en español, sin `Co-Authored-By`. No hacer push sin confirmación.
6. Después de esta entrega, retomar la Fase 5: criterios y runner de evaluación RAG, condicionados por la definición del corpus final.

## Archivos principales de esta entrega

- `components/marca/zulu-mascota.tsx`
- `components/chat/personalidad-zulu.tsx`
- `components/chat/conversacion.tsx`
- `components/chat/chat-publico.tsx`
- `components/chat/navegacion-cuenta-publica.tsx`
- `app/(auth)/formulario-auth.tsx`
- `app/chat/[id]/page.tsx`
- `app/page.tsx`
- `app/globals.css`
- `public/images/zulu/`
- `docs/notes/zulu-visual-system.md`
- `docs/notes/zulu-estados-preview.png`
