export function resolverDestinoSeguro(
  value: string | null,
  origin: string
): URL {
  const fallback = new URL("/", origin);
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /%5c/i.test(value)
  ) {
    return fallback;
  }

  const destino = new URL(value, origin);
  return destino.origin === fallback.origin ? destino : fallback;
}
