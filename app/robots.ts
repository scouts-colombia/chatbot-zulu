import type { MetadataRoute } from "next";
import { URL_SITIO } from "@/lib/seo";

/**
 * Solo `/` es contenido público indexable. El resto son rutas de sesión,
 * conversaciones privadas o el panel admin: se bloquean aquí para no gastar
 * presupuesto de rastreo, además del `noindex` que cada una declara.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/auth/", "/chat/", "/login", "/registro"],
    },
    sitemap: `${URL_SITIO}/sitemap.xml`,
    host: URL_SITIO,
  };
}
