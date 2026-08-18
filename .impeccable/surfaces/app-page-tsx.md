---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/api/chat/route.ts","components/chat/conversacion.tsx","app/(auth)/formulario-auth.tsx"]
---

# Brief de superficie: chat público de Zulú

- Modo: Operate. La persona llega para resolver una pregunta sobre Scouts Colombia, no para completar un onboarding.
- Usuario primario: visitante público, incluidos jóvenes desde 15 años, que todavía no tiene una cuenta activa.
- Trabajo principal: escribir y enviar una primera consulta de inmediato; leer una respuesta respaldada por citas; conservar esa conversación al registrarse.
- Restricción central: un único turno gratuito por identidad seudónima. El segundo intento no se pierde: conserva el borrador y presenta una invitación inequívoca a registrarse o iniciar sesión.
- Jerarquía: la composición y el campo de pregunta son protagonistas. Las acciones “Iniciar sesión” y “Crear cuenta” son visibles pero secundarias hasta que se consume el turno.
- Autoridad visual: `D:\dev\ruta-dnpj\ruta`, en especial `/diseno/componentes`. Reutilizar Futura Std, su fondo crema con lavados de color, los cinco colores de marca, radios, bordes, foco y superficies liquid-glass. No reintroducir el fondo morado del login.
- Tono: cercano, claro y juvenil sin infantilizar. El producto se llama “Zulú”; su biblioteca aprobada de poses acompaña marca, bienvenida, espera, respuesta y recuperación sin desplazar la tarea principal ni sustituir el texto.
- Accesibilidad: contraste WCAG AA, objetivos táctiles mínimos de 44 px, foco visible, estados no comunicados solo por color, reducción de movimiento y estructura responsive real.
- Estados obligatorios: vacío, escribiendo, enviando, respuesta, citas, error recuperable, límite consumido y conversión a cuenta.
- Contrato de dirección: una superficie crema cálida con lavados radiales amarillo y durazno, textura sutil y vidrio claro; color vivo reservado para navegación, acción y estado. Zulú es exclusivamente claro: no hay modo oscuro ni selector de tema.
