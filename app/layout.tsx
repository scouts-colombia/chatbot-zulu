import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { InstalarPwa } from "@/components/pwa/instalar-pwa";
import {
  DESCRIPCION_SITIO,
  NOMBRE_ORGANIZACION,
  NOMBRE_SITIO,
  TITULO_INICIO,
  URL_ORGANIZACION,
  URL_SITIO,
} from "@/lib/seo";
import { futuraStd } from "./futura";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITIO),
  title: {
    default: TITULO_INICIO,
    // Cada página aporta solo su parte: "Iniciar sesión" → "Zulú | Iniciar sesión".
    template: `${NOMBRE_SITIO} | %s`,
  },
  description: DESCRIPCION_SITIO,
  applicationName: NOMBRE_SITIO,
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  authors: [{ name: NOMBRE_ORGANIZACION, url: URL_ORGANIZACION }],
  creator: NOMBRE_ORGANIZACION,
  publisher: NOMBRE_ORGANIZACION,
  category: "education",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: NOMBRE_SITIO,
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Sin estos, Google recorta la miniatura del snippet y la og:image
      // pierde tamaño en resultados enriquecidos.
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "/",
    siteName: NOMBRE_SITIO,
    title: TITULO_INICIO,
    description: DESCRIPCION_SITIO,
    // La imagen la genera la convención de archivo app/opengraph-image.png
    // (+ app/opengraph-image.alt.txt). Declararla aquí también hace que
    // Next fusione ambas y produzca una og:image rota.
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO_INICIO,
    description: DESCRIPCION_SITIO,
  },
};

export const viewport: Viewport = {
  // Sin `maximumScale`: fijarlo bloquea el zoom del navegador (WCAG 1.4.4) y
  // Lighthouse lo reporta como fallo de accesibilidad.
  themeColor: "#4d006e",
};

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const datosEstructurados = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: NOMBRE_SITIO,
  alternateName: "Zulú, asistente Scout",
  url: `${URL_SITIO}/`,
  description: DESCRIPCION_SITIO,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  inLanguage: "es-CO",
  isAccessibleForFree: true,
  publisher: {
    "@type": "Organization",
    name: NOMBRE_ORGANIZACION,
    url: URL_ORGANIZACION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${futuraStd.variable} ${geistMono.variable}`}
      lang="es-CO"
    >
      <body className="antialiased">
        {children}
        <InstalarPwa />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD estático, sin datos de usuario.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(datosEstructurados),
          }}
          type="application/ld+json"
        />
      </body>
    </html>
  );
}
