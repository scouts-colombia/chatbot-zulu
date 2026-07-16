import localFont from "next/font/local";

// Tipografías de marca traídas de scouts-colombia/ruta (app/futura.ts y
// app/jollygood.ts). Futura es la sans del sistema; JollyGood es display
// para wordmarks y titulares.

export const futuraStd = localFont({
  src: [
    { path: "./fonts/futura-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/futura-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/futura-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/futura-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/futura-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});

// La fuente solo cubre los caracteres con glifo limpio (el archivo de origen
// es una demo que marca de agua parte del ASCII, y el español se sintetizó
// desde piezas de la propia fuente). Todo lo demás cae a Futura vía fallback.
export const jollyGood = localFont({
  src: [
    { path: "./fonts/jollygood-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/jollygood-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jollygood-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/jollygood-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/jollygood-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/jollygood-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-jollygood",
  display: "swap",
  adjustFontFallback: "Arial",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0020-0021, U+0027, U+002C-002E, U+0030-0033, U+0035-0039, U+003A-003B, U+003F, U+0041-005A, U+0060-007A, U+00A1, U+00BF, U+00C1, U+00C9, U+00CD, U+00D1, U+00D3, U+00DA, U+00DC, U+00E1, U+00E9, U+00ED, U+00F1, U+00F3, U+00FA, U+00FC",
    },
  ],
});
