/**
 * Origen público del sitio, resuelto en build.
 *
 * `SITE_URL` manda. Si falta, se cae a la URL de producción que Vercel expone
 * (`VERCEL_PROJECT_PRODUCTION_URL`, sin protocolo, la misma en producción y en
 * preview) para que un despliegue sin la variable no genere metadata apuntando
 * a localhost, como pasó con la og:image del piloto.
 */
const origenConfigurado =
  process.env.SITE_URL?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "");

export const URL_SITIO = (origenConfigurado || "http://localhost:3000").replace(
  /\/+$/,
  ""
);

export const NOMBRE_SITIO = "Zulú";

export const TITULO_INICIO = "Zulú | Asistente Scout de manuales oficiales";

export const DESCRIPCION_SITIO =
  "Consulta los manuales oficiales de Scouts de Colombia en lenguaje natural y recibe respuestas con citas verificables al documento y la página.";

export const URL_ORGANIZACION = "https://scout.org.co";

export const NOMBRE_ORGANIZACION = "Scouts de Colombia";
