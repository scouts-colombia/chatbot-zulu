import { NextResponse } from "next/server";
import { resolverDestinoSeguro } from "@/lib/auth/destino-seguro";
import { esIdTraspasoBorradorValido } from "@/lib/invitados/borrador";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destino = resolverDestinoSeguro(
    url.searchParams.get("next"),
    url.origin
  );
  const borrador = destino.searchParams.get("borrador");
  const conversationId = destino.searchParams.get("conversacion");

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
  if (esIdTraspasoBorradorValido(borrador)) {
    errorUrl.searchParams.set("borrador", borrador);
    if (esIdTraspasoBorradorValido(conversationId)) {
      errorUrl.searchParams.set("conversacion", conversationId);
    }
  }
  return NextResponse.redirect(errorUrl);
}
