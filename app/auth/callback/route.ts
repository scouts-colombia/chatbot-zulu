import { NextResponse } from "next/server";
import { resolverDestinoSeguro } from "@/lib/auth/destino-seguro";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destino = resolverDestinoSeguro(
    url.searchParams.get("next"),
    url.origin
  );

  if (code) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(destino);
    }
    console.error("[auth] No se pudo intercambiar el código:", error);
  }

  const errorUrl = new URL("/registro", url.origin);
  errorUrl.searchParams.set("error", "enlace_invalido");
  return NextResponse.redirect(errorUrl);
}
