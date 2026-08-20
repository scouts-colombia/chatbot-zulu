const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Todos los identificadores opacos del piloto son UUID v4: los produce
 * `crypto.randomUUID()` en el navegador y el servidor, `gen_random_uuid()` en
 * PostgreSQL y Supabase Auth para `auth.users.id`. Varios de ellos llegan desde
 * la URL o desde `localStorage`, así que la validación es la frontera de
 * confianza y vive en un solo lugar: tres copias del regex se desincronizan (una
 * de ellas ya aceptaba v1-v5) y ninguna de las tres dice cuál es la correcta.
 */
export function esUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}
