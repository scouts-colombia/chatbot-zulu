import localFont from "next/font/local";

export const albertSans = localFont({
  src: [
    {
      path: "./fonts/albert-sans-variable.woff2",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "./fonts/albert-sans-variable-italic.woff2",
      style: "italic",
      weight: "100 900",
    },
  ],
  adjustFontFallback: "Arial",
  display: "swap",
  variable: "--font-albert",
});

export const jollygood = localFont({
  src: [
    { path: "./fonts/jollygood-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/jollygood-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jollygood-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/jollygood-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/jollygood-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/jollygood-900.woff2", weight: "900", style: "normal" },
  ],
  adjustFontFallback: "Arial",
  display: "swap",
});
