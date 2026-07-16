import { createClient } from "@supabase/supabase-js";
import "server-only";

/**
 * Cliente con la secret key: SALTA la RLS. Solo para lo que el cliente no
 * debe poder forjar (mensajes del asistente, citas, eventos, auditoría,
 * caché de consentimiento). Ver CLAUDE.md § Privacidad, admin y RLS.
 */
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SECRET_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
