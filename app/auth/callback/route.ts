import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

function destinoSeguro(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destino = destinoSeguro(url.searchParams.get("next"));

  if (code) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(destino, url.origin));
    }
    console.error("[auth] No se pudo intercambiar el código:", error);
  }

  const errorUrl = new URL("/registro", url.origin);
  errorUrl.searchParams.set("error", "enlace_invalido");
  return NextResponse.redirect(errorUrl);
}
