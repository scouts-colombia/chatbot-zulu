"use server";

import { createClient } from "@supabase/supabase-js";
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
    error: errorUsuarioAnterior,
  } = await supabase.auth.getUser();
  const sesionAusente =
    errorUsuarioAnterior?.name === "AuthSessionMissingError";
  if (errorUsuarioAnterior && !sesionAusente) {
    console.error(
      "[auth] No se pudo verificar la sesión antes de iniciar sesión:",
      errorUsuarioAnterior
    );
    return {
      error:
        "No pudimos verificar tu sesión actual. Inténtalo de nuevo para conservar tu conversación.",
    };
  }
  const invitadoAnterior =
    usuarioAnterior?.is_anonymous === true ? usuarioAnterior.id : null;
  const credenciales = {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };

  if (invitadoAnterior) {
    // Este cliente no escribe cookies. La sesión anónima sigue activa hasta
    // que la transferencia termina, así un fallo transitorio es reintentable.
    const verificador = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      }
    );
    const { data, error } =
      await verificador.auth.signInWithPassword(credenciales);

    if (error || !data.user || !data.session) {
      return {
        error: traducirError(error?.code, error?.message ?? "Sesión inválida"),
      };
    }

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
          "No pudimos asociar tu conversación de prueba. Tu sesión invitada sigue activa; inténtalo de nuevo.",
      };
    }

    const { error: errorSesion } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (errorSesion) {
      return {
        error:
          "La conversación quedó asociada, pero no pudimos iniciar la sesión. Inténtalo de nuevo.",
      };
    }

    // La reserva conserva sus HMAC/UUID sin FK al perfil para mantener el
    // límite antiabuso; la conversación ya pertenece a la cuenta permanente.
    const { error: errorEliminarInvitado } =
      await admin.auth.admin.deleteUser(invitadoAnterior);
    if (errorEliminarInvitado) {
      console.error(
        "[auth] No se pudo eliminar la identidad invitada transferida:",
        errorEliminarInvitado
      );
    }

    revalidatePath("/", "layout");
    redirect("/");
  }

  const { error } = await supabase.auth.signInWithPassword(credenciales);
  if (error) {
    return { error: traducirError(error.code, error.message) };
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
  if (password.length < 8) {
    return { error: MENSAJES_ERROR.weak_password };
  }

  const {
    data: { user: usuarioActual },
    error: errorUsuarioActual,
  } = await supabase.auth.getUser();
  const sesionAusente = errorUsuarioActual?.name === "AuthSessionMissingError";
  if (errorUsuarioActual && !sesionAusente) {
    console.error(
      "[auth] No se pudo verificar la sesión antes del registro:",
      errorUsuarioActual
    );
    return {
      error:
        "No pudimos verificar tu sesión actual. Inténtalo de nuevo para conservar tu conversación.",
    };
  }

  if (usuarioActual?.is_anonymous === true) {
    const origen = await obtenerOrigen();
    const { error } = await supabase.auth.updateUser(
      {
        email,
        password,
        data: {
          nombre,
          registro_pendiente_password: false,
        },
      },
      {
        emailRedirectTo: `${origen}/auth/callback?next=${encodeURIComponent("/")}`,
      }
    );

    if (error) {
      return { error: traducirError(error.code, error.message) };
    }

    return {
      error: null,
      mensaje:
        "Te enviamos un enlace para verificar tu correo. Ábrelo para activar la cuenta y conservar tu conversación.",
    };
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
    error: errorUsuario,
  } = await supabase.auth.getUser();
  if (errorUsuario && errorUsuario.name !== "AuthSessionMissingError") {
    console.error(
      "[auth] No se pudo verificar la sesión para aceptar la política:",
      errorUsuario
    );
    redirect("/?aviso=consentimiento");
  }
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
    error: errorUsuario,
  } = await supabase.auth.getUser();
  if (errorUsuario && errorUsuario.name !== "AuthSessionMissingError") {
    console.error(
      "[auth] No se pudo verificar la sesión para finalizar el registro:",
      errorUsuario
    );
    return {
      error: "No pudimos verificar tu sesión. Inténtalo de nuevo.",
    };
  }
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
