import localFont from "next/font/local";

export const futuraStd = localFont({
  src: [
    { path: "./fonts/futura-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/futura-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/futura-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/futura-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/futura-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-futura",
  display: "swap",
  adjustFontFallback: "Arial",
});
