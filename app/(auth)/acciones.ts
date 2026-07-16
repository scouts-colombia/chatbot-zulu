"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function iniciarSesion(
  _estadoPrevio: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
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

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
