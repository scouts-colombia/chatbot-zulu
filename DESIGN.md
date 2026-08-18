# Sistema visual de Zulú

Zulú hereda el lenguaje visual de Ruta DNPJ: color vivo, tipografía Futura,
superficies translúcidas y bordes suaves. Este documento es la referencia para
mantener la misma sensación en chat, autenticación y administración.

## Marca

- Morado principal: `#4d006e`.
- Amarillo: `#ffcd00`.
- Azul: `#003087`.
- Rojo: `#c40f2f`.
- Naranja: `#ff8308`.
- Fondo de producto: crema `#fff8eb`, igual a Ruta `/diseno/componentes`, con
  lavados radiales amarillo y durazno de baja opacidad y textura sutil.
- Nombre visible: **Zulú**. `zulu-marca.png` acompaña el nombre en los encabezados. La biblioteca de 21 poses transparentes de `public/images/zulu/estados/` expresa bienvenida, búsqueda, lectura, respuesta, aclaración, ausencia de fuente, protección, error y archivo mediante `ZuluMascota`; todas son decorativas para lectores de pantalla y el texto conserva el significado completo.

## Tipografía

- Interfaz y titulares: Futura Std local, pesos 300–700.
- Datos técnicos o monoespaciados: Geist Mono.
- Titulares compactos, con tracking negativo moderado; el cuerpo conserva una
  altura de línea cómoda y nunca baja de 12 px.

## Forma y profundidad

- Radio base: `0.75rem`.
- Tarjetas principales: radio de 16–24 px según escala.
- Liquid glass: fondo blanco translúcido, borde blanco tenue, blur de 18–24 px,
  brillo interior superior y sombra morada profunda.
- Composer: cápsula blanca translúcida con botón circular morado.
- Los botones usan color sólido de marca y una respuesta física breve al
  presionar; no se usan gradientes en botones.

## Layout

- El chat público ocupa el viewport completo y mantiene header, composer y pie
  visibles; solo la transcripción puede desplazarse.
- El estado vacío centra la pregunta guía y deja el composer en la parte baja.
- Autenticación usa el mismo fondo con una sola tarjeta de vidrio centrada.
- En móvil se conserva el orden de lectura, objetivos táctiles mínimos de 44 px
  y márgenes laterales de 16 px.

## Accesibilidad y movimiento

- Foco visible morado, con separación suficiente del componente.
- Contraste de texto validado sobre el fondo crema y las superficies claras.
- Errores usan `role="alert"`; mensajes de éxito usan un elemento `output`.
- `prefers-reduced-motion` elimina transiciones y animaciones no esenciales.
- Los fallbacks sin `backdrop-filter` mantienen fondo opaco y legible.
- No existe modo oscuro, selector de tema ni adaptación automática al sistema.
