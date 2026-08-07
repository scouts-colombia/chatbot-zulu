"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { construirHashesSolicitud } from "@/lib/invitados/identidad";
import {
  URL_POLITICA_PRIVACIDAD,
  VERSION_POLITICA_PRIVACIDAD,
} from "@/lib/privacidad";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoFormulario = {
  error: string | null;
  mensaje?: string;
};

const MENSAJES_ERROR: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de iniciar sesión.",
  user_already_exists: "Ya existe una cuenta con ese correo.",
  weak_password: "La contraseña debe tener al menos 8 caracteres.",
  over_email_send_rate_limit:
    "Demasiados intentos. Espera un momento y vuelve a intentar.",
};

function traducirError(codigo: string | undefined, mensaje: string) {
  return MENSAJES_ERROR[codigo ?? ""] ?? `No se pudo completar: ${mensaje}`;
}

async function obtenerOrigen() {
  const cabeceras = await headers();
  const host =
    cabeceras.get("x-forwarded-host") ??
    cabeceras.get("host") ??
    "localhost:3000";
  const protocolo =
    cabeceras.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return (process.env.SITE_URL?.trim() || `${protocolo}://${host}`).replace(
    /\/$/,
    ""
  );
}

export async function iniciarSesion(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const {
    data: { user: usuarioAnterior },
  } = await supabase.auth.getUser();
  const invitadoAnterior =
    usuarioAnterior?.is_anonymous === true ? usuarioAnterior.id : null;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (error) {
    return { error: traducirError(error.code, error.message) };
  }

  if (invitadoAnterior && data.user) {
    const admin = crearClienteAdmin();
    const { error: errorTransferencia } = await admin.rpc(
      "transferir_conversaciones_invitadas",
      {
        p_guest_user_id: invitadoAnterior,
        p_target_user_id: data.user.id,
      }
    );
    if (errorTransferencia) {
      console.error(
        "[auth] No se pudo transferir la conversación invitada:",
        errorTransferencia
      );
      return {
        error:
          "Iniciaste sesión, pero no pudimos asociar tu conversación de prueba. Recarga e inténtalo de nuevo.",
      };
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function registrarse(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!nombre) {
    return { error: "Escribe tu nombre." };
  }

  const {
    data: { user: usuarioActual },
  } = await supabase.auth.getUser();

  if (usuarioActual?.is_anonymous === true) {
    const origen = await obtenerOrigen();
    const { error } = await supabase.auth.updateUser(
      {
        email,
        data: {
          nombre,
          registro_pendiente_password: true,
        },
      },
      {
        emailRedirectTo: `${origen}/auth/callback?next=${encodeURIComponent("/registro")}`,
      }
    );

    if (error) {
      return { error: traducirError(error.code, error.message) };
    }

    return {
      error: null,
      mensaje:
        "Te enviamos un enlace para verificar tu correo. Ábrelo en este dispositivo para conservar la conversación y crear tu contraseña.",
    };
  }

  if (password.length < 8) {
    return { error: MENSAJES_ERROR.weak_password };
  }

  const origen = await obtenerOrigen();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre },
      emailRedirectTo: `${origen}/auth/callback?next=${encodeURIComponent("/")}`,
    },
  });

  if (error) {
    return { error: traducirError(error.code, error.message) };
  }

  if (!data.session) {
    return {
      error: null,
      mensaje:
        "Te enviamos un correo de confirmación. Ábrelo para activar tu cuenta y luego inicia sesión.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function aceptarPoliticaPrivacidad() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous === true) {
    redirect("/");
  }

  const origen = await obtenerOrigen();
  const cabeceras = await headers();
  const secret = process.env.GUEST_LIMIT_SECRET ?? "";
  let hashes: ReturnType<typeof construirHashesSolicitud>;
  try {
    hashes = construirHashesSolicitud({
      request: new Request(origen, { headers: new Headers(cabeceras) }),
      secret,
    });
  } catch (error) {
    console.error("[auth] No se pudo seudonimizar el consentimiento:", error);
    redirect("/?aviso=consentimiento");
  }

  const admin = crearClienteAdmin();
  const { error } = await admin.rpc("registrar_consentimiento_servidor", {
    p_user_id: user.id,
    p_policy_version: VERSION_POLITICA_PRIVACIDAD,
    p_policy_url: URL_POLITICA_PRIVACIDAD,
    p_ip_hash: hashes.ipHash,
    p_user_agent_hash: hashes.userAgentHash,
  });
  if (error) {
    console.error("[auth] No se pudo registrar el consentimiento:", error);
    redirect("/?aviso=consentimiento");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function finalizarRegistro(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: MENSAJES_ERROR.weak_password };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (
    !user ||
    user.is_anonymous === true ||
    user.user_metadata?.registro_pendiente_password !== true
  ) {
    return {
      error:
        "El enlace de verificación no es válido o ya terminaste el registro.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password,
    data: { registro_pendiente_password: false },
  });
  if (error) {
    return { error: traducirError(error.code, error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
