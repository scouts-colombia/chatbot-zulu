import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { esFalloDeVerificacionDeSesion } from "@/lib/auth/sesion";
import {
  ERROR_AUTENTICACION_NO_DISPONIBLE,
  ERROR_CONSENTIMIENTO_REQUERIDO,
  ERROR_CONVERSACION_NO_DISPONIBLE,
  ERROR_INVITADO_NO_DISPONIBLE,
  ERROR_POLITICA_ACTUALIZADA,
  respuestaError,
} from "@/lib/chat/respuestas-error";
import type { IdentidadInvitada } from "@/lib/invitados/identidad";
import { respuestaRegistroPorLimite } from "@/lib/invitados/limites";
import { limpiarIdentidadesInvitadasPendientes } from "@/lib/invitados/limpieza";
import {
  asegurarIdentidadInvitada,
  leerPreflightPendiente,
  liberarPreflightInvitado,
  obtenerOCrearConversacionInvitada,
  prepararPreflightInvitado,
} from "@/lib/invitados/preflight";
import { esVersionPoliticaVigente } from "@/lib/privacidad";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

const LOG = "[chat/invitado]";

const CuerpoSchema = z.object({
  aceptaPolitica: z.literal(true),
  versionPoliticaAceptada: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  let cuerpo: z.infer<typeof CuerpoSchema>;
  try {
    cuerpo = CuerpoSchema.parse(await request.json());
  } catch {
    return respuestaError(ERROR_CONSENTIMIENTO_REQUERIDO, 403);
  }

  if (!esVersionPoliticaVigente(cuerpo.versionPoliticaAceptada)) {
    return respuestaError(ERROR_POLITICA_ACTUALIZADA, 409);
  }

  const supabase = await crearClienteServidor();
  const admin = crearClienteAdmin();
  const cookieStore = await cookies();
  const {
    data: { user },
    error: errorAutenticacion,
  } = await supabase.auth.getUser();

  if (esFalloDeVerificacionDeSesion(errorAutenticacion)) {
    console.error(`${LOG} No se pudo verificar la sesión:`, errorAutenticacion);
    return respuestaError(ERROR_AUTENTICACION_NO_DISPONIBLE, 503);
  }

  if (user) {
    if (user.is_anonymous !== true) {
      return respuestaError(
        {
          codigo: "sesion_permanente_activa",
          mensaje:
            "Tu cuenta ya está activa. Recarga la página para continuar.",
        },
        409
      );
    }
    const conversationId = await obtenerOCrearConversacionInvitada(
      admin,
      user.id,
      LOG
    );
    if (!conversationId) {
      return respuestaError(ERROR_CONVERSACION_NO_DISPONIBLE, 503);
    }
    return NextResponse.json({ sesionPreparada: true, conversationId });
  }

  await limpiarIdentidadesInvitadasPendientes(admin, { limite: 1 });

  if (leerPreflightPendiente(cookieStore)) {
    return respuestaError(
      {
        codigo: "sesion_invitada_pendiente",
        mensaje:
          "No pudimos completar tu sesión de prueba. Espera unos minutos e intenta de nuevo.",
      },
      503
    );
  }

  let identidad: IdentidadInvitada;
  try {
    identidad = await asegurarIdentidadInvitada(request);
  } catch (error) {
    console.error(`${LOG} Identidad no disponible:`, error);
    return respuestaError(ERROR_INVITADO_NO_DISPONIBLE, 503);
  }

  const preparacion = await prepararPreflightInvitado(admin, identidad, LOG);
  if (preparacion.tipo === "limite") {
    return respuestaError(
      respuestaRegistroPorLimite(preparacion.mensajeError),
      429
    );
  }
  if (preparacion.tipo === "no_disponible") {
    return respuestaError(ERROR_INVITADO_NO_DISPONIBLE, 503);
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user || !data.session) {
    // El cupo solo se devuelve si no queda una identidad a medias que pueda
    // seguir usándolo; si el borrado falla, la reserva expira por TTL.
    let puedeLiberarPreflight = !data.user;
    if (data.user) {
      const { error: errorBorrado } = await admin.auth.admin.deleteUser(
        data.user.id
      );
      puedeLiberarPreflight = !errorBorrado;
      if (errorBorrado) {
        console.error(
          `${LOG} No se pudo eliminar la identidad incompleta:`,
          errorBorrado
        );
      }
    }
    if (puedeLiberarPreflight) {
      await liberarPreflightInvitado(admin, preparacion.preflightId, LOG);
    }
    console.error(`${LOG} No se pudo iniciar la sesión:`, error);
    return respuestaError(ERROR_INVITADO_NO_DISPONIBLE, 503);
  }

  const conversationId = await obtenerOCrearConversacionInvitada(
    admin,
    data.user.id,
    LOG
  );
  if (!conversationId) {
    return respuestaError(ERROR_CONVERSACION_NO_DISPONIBLE, 503);
  }

  return NextResponse.json({ sesionPreparada: true, conversationId });
}
