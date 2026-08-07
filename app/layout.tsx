import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { futuraStd } from "./futura";

import "./globals.css";

export const metadata: Metadata = {
  title: "Zulú",
  description:
    "Asistente para consultar los manuales oficiales de la organización Scout, con citas verificables.",
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
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
