import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { InstalarPwa } from "@/components/pwa/instalar-pwa";
import { futuraStd } from "./futura";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_URL?.trim() || "http://localhost:3000"
  ),
  title: "Zulú",
  description:
    "Asistente para consultar los manuales oficiales de la organización Scout, con citas verificables.",
  applicationName: "Zulú",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zulú",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Zulú",
    title: "Zulú · Asistente Scout",
    description:
      "Consulta los manuales oficiales de Scouts Colombia y recibe respuestas con fuentes verificables.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Conversación de ejemplo con Zulú, el asistente Scout",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zulú · Asistente Scout",
    description:
      "Consulta los manuales oficiales de Scouts Colombia y recibe respuestas con fuentes verificables.",
    images: ["/opengraph-image.png"],
  },
};

export const viewport: Viewport = {
  maximumScale: 1,
  themeColor: "#4d006e",
};

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${futuraStd.variable} ${geistMono.variable}`} lang="es">
      <body className="antialiased">
        {children}
        <InstalarPwa />
      </body>
    </html>
  );
}
