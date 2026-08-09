import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  COOKIE_DISPOSITIVO_INVITADO,
  construirIdentidadInvitada,
  crearIdDispositivo,
  esIdDispositivoValido,
  type IdentidadInvitada,
} from "@/lib/invitados/identidad";
import { respuestaRegistroPorLimite } from "@/lib/invitados/limites";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

const CuerpoSchema = z.object({
  aceptaPolitica: z.literal(true),
});

async function obtenerIdentidadInvitada(request: Request) {
  const secret = process.env.GUEST_LIMIT_SECRET ?? "";
  const cookieStore = await cookies();
  const cookieActual = cookieStore.get(COOKIE_DISPOSITIVO_INVITADO)?.value;
  const deviceId = esIdDispositivoValido(cookieActual)
    ? (cookieActual as string)
    : crearIdDispositivo();

  if (deviceId !== cookieActual) {
    cookieStore.set(COOKIE_DISPOSITIVO_INVITADO, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return construirIdentidadInvitada({ request, deviceId, secret });
}

export async function POST(request: Request) {
  try {
    CuerpoSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        codigo: "consentimiento_requerido",
        mensaje:
          "Debes aceptar la política de privacidad vigente antes de usar el chat.",
      },
      { status: 403 }
    );
  }

  const supabase = await crearClienteServidor();
  const admin = crearClienteAdmin();
  const {
    data: { user },
    error: errorAutenticacion,
  } = await supabase.auth.getUser();
  const sesionAusente = errorAutenticacion?.name === "AuthSessionMissingError";

  if (errorAutenticacion && !sesionAusente) {
    console.error(
      "[chat/invitado] No se pudo verificar la sesión:",
      errorAutenticacion
    );
    return NextResponse.json(
      {
        codigo: "autenticacion_no_disponible",
        mensaje: "No pudimos verificar tu sesión. Intenta de nuevo.",
      },
      { status: 503 }
    );
  }

  if (user) {
    if (user.is_anonymous === true) {
      return NextResponse.json({ preflightId: null });
    }
    return NextResponse.json(
      {
        codigo: "sesion_permanente_activa",
        mensaje: "Tu cuenta ya está activa. Recarga la página para continuar.",
      },
      { status: 409 }
    );
  }

  let identidad: IdentidadInvitada;
  try {
    identidad = await obtenerIdentidadInvitada(request);
  } catch (error) {
    console.error("[chat/invitado] Identidad no disponible:", error);
    return NextResponse.json(
      {
        codigo: "invitado_no_disponible",
        mensaje:
          "El turno de prueba no está disponible en este momento. Intenta de nuevo más tarde.",
      },
      { status: 503 }
    );
  }

  const preflight = await admin.rpc("preparar_turno_invitado", {
    p_device_hash: identidad.deviceHash,
    p_environment_hash: identidad.environmentHash,
    p_network_hash: identidad.networkHash,
  });
  if (preflight.error || !preflight.data) {
    if (
      /limite_invitado|limite_red_invitada/.test(preflight.error?.message ?? "")
    ) {
      return NextResponse.json(
        respuestaRegistroPorLimite(preflight.error?.message ?? ""),
        { status: 429 }
      );
    }
    console.error(
      "[chat/invitado] No se pudo preparar el turno:",
      preflight.error
    );
    return NextResponse.json(
      {
        codigo: "invitado_no_disponible",
        mensaje:
          "El turno de prueba no está disponible en este momento. Intenta de nuevo más tarde.",
      },
      { status: 503 }
    );
  }

  const preflightId = preflight.data as string;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user || !data.session) {
    if (data.user) {
      const { error: errorBorrado } = await admin.auth.admin.deleteUser(
        data.user.id
      );
      if (errorBorrado) {
        console.error(
          "[chat/invitado] No se pudo eliminar la identidad incompleta:",
          errorBorrado
        );
      }
    }
    await admin.rpc("liberar_preflight_turno_invitado", {
      p_preflight_id: preflightId,
    });
    console.error("[chat/invitado] No se pudo iniciar la sesión:", error);
    return NextResponse.json(
      {
        codigo: "invitado_no_disponible",
        mensaje:
          "El turno de prueba no está disponible en este momento. Intenta de nuevo más tarde.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ preflightId });
}
