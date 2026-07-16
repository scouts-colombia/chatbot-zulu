import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import "server-only";

/**
 * Cliente Supabase con la sesión del usuario (JWT en cookies).
 * Este es el cliente del camino del chat: la RLS aplica.
 */
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component: el proxy refresca la sesión.
          }
        },
      },
    }
  );
}
