import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para componentes de cliente (publishable key). */
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );
}
