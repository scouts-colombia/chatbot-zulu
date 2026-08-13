import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  COOKIE_DISPOSITIVO_INVITADO,
  COOKIE_PREFLIGHT_INVITADO,
  construirIdentidadInvitada,
  crearIdDispositivo,
  esIdDispositivoValido,
  esIdPreflightValido,
  type IdentidadInvitada,
  leerPreparacionPreflightInvitado,
} from "@/lib/invitados/identidad";
import { respuestaRegistroPorLimite } from "@/lib/invitados/limites";
import { limpiarIdentidadesInvitadasPendientes } from "@/lib/invitados/limpieza";
import {
  esVersionPoliticaVigente,
  VERSION_POLITICA_PRIVACIDAD,
} from "@/lib/privacidad";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

const CuerpoSchema = z.object({
  aceptaPolitica: z.literal(true),
  versionPoliticaAceptada: z.string().min(1).max(200),
});

async function prepararConversacionInvitada(
  admin: ReturnType<typeof crearClienteAdmin>,
  userId: string
) {
  const { data, error } = await admin.rpc(
    "obtener_o_crear_conversacion_invitada",
    { p_user_id: userId }
  );
  if (error || typeof data !== "string") {
    console.error(
      "[chat/invitado] No se pudo preparar la conversación:",
      error
    );
    return null;
  }
  return data;
}

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
  let cuerpo: z.infer<typeof CuerpoSchema>;
  try {
    cuerpo = CuerpoSchema.parse(await request.json());
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

  if (!esVersionPoliticaVigente(cuerpo.versionPoliticaAceptada)) {
    return NextResponse.json(
      {
        codigo: "politica_actualizada",
        mensaje:
          "La política de privacidad cambió. Revisa y acepta la versión vigente antes de enviar.",
        versionPolitica: VERSION_POLITICA_PRIVACIDAD,
      },
      { status: 409 }
    );
  }

  const supabase = await crearClienteServidor();
  const admin = crearClienteAdmin();
  const cookieStore = await cookies();
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
      const conversationId = await prepararConversacionInvitada(admin, user.id);
      if (!conversationId) {
        return NextResponse.json(
          {
            codigo: "conversacion_no_disponible",
            mensaje: "No pudimos preparar tu conversación. Intenta de nuevo.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ sesionPreparada: true, conversationId });
    }
    return NextResponse.json(
      {
        codigo: "sesion_permanente_activa",
        mensaje: "Tu cuenta ya está activa. Recarga la página para continuar.",
      },
      { status: 409 }
    );
  }

  await limpiarIdentidadesInvitadasPendientes(admin, { limite: 1 });

  const preflightPendiente = cookieStore.get(COOKIE_PREFLIGHT_INVITADO)?.value;
  if (esIdPreflightValido(preflightPendiente)) {
    return NextResponse.json(
      {
        codigo: "sesion_invitada_pendiente",
        mensaje:
          "No pudimos completar tu sesión de prueba. Espera unos minutos e intenta de nuevo.",
      },
      { status: 503 }
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

  const preflight = await admin.rpc("preparar_turno_invitado_v2", {
    p_device_hash: identidad.deviceHash,
    p_environment_hash: identidad.environmentHash,
    p_network_hash: identidad.networkHash,
  });
  const preparacion = leerPreparacionPreflightInvitado(preflight.data);
  if (preflight.error || !preparacion) {
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

  const { preflightId, ttlSeconds } = preparacion;
  cookieStore.set(COOKIE_PREFLIGHT_INVITADO, preflightId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
  });

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user || !data.session) {
    let puedeLiberarPreflight = !data.user;
    if (data.user) {
      const { error: errorBorrado } = await admin.auth.admin.deleteUser(
        data.user.id
      );
      puedeLiberarPreflight = !errorBorrado;
      if (errorBorrado) {
        console.error(
          "[chat/invitado] No se pudo eliminar la identidad incompleta:",
          errorBorrado
        );
      }
    }
    if (puedeLiberarPreflight) {
      const liberacion = await admin.rpc("liberar_preflight_turno_invitado", {
        p_preflight_id: preflightId,
      });
      if (liberacion.error) {
        console.error(
          "[chat/invitado] No se pudo liberar el preflight:",
          liberacion.error
        );
      } else {
        cookieStore.delete(COOKIE_PREFLIGHT_INVITADO);
      }
    }
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

  const conversationId = await prepararConversacionInvitada(
    admin,
    data.user.id
  );
  if (!conversationId) {
    return NextResponse.json(
      {
        codigo: "conversacion_no_disponible",
        mensaje: "No pudimos preparar tu conversación. Intenta de nuevo.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ sesionPreparada: true, conversationId });
}
