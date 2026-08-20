import type { MetadataRoute } from "next";
import { URL_SITIO } from "@/lib/seo";

/**
 * Solo `/` es contenido público indexable, pero las rutas de página no se
 * bloquean aquí: un `Disallow` impide al rastreador leer el `noindex` que cada
 * una declara, y la URL puede terminar indexada igual —sin descripción— si
 * alguien la enlaza. Se bloquea únicamente lo que no es página y por tanto no
 * puede llevar esa etiqueta.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/"],
    },
    sitemap: `${URL_SITIO}/sitemap.xml`,
    host: URL_SITIO,
  };
}
