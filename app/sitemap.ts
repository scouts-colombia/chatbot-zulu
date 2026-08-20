import type { MetadataRoute } from "next";
import { URL_SITIO } from "@/lib/seo";

/**
 * Una sola entrada a propósito: las demás rutas son privadas o utilitarias y
 * van con `noindex`. Un sitemap que las listara contradiría esa directiva.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${URL_SITIO}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
