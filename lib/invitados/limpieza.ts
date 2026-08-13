const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ErrorSupabase = { message: string } | null;
type UsuarioAuthMinimo = { is_anonymous?: boolean } | null;

export type ClienteLimpiezaInvitados = {
  rpc: (
    funcion: string,
    parametros: { p_limite: number; p_preferida: string | null }
  ) => PromiseLike<{ data: unknown; error: ErrorSupabase }>;
  auth: {
    admin: {
      getUserById: (userId: string) => PromiseLike<{
        data: { user: UsuarioAuthMinimo };
        error: ErrorSupabase;
      }>;
      deleteUser: (userId: string) => PromiseLike<{ error: ErrorSupabase }>;
    };
  };
};

type OpcionesLimpieza = {
  limite?: number;
  preferida?: string | null;
};

export type ResultadoLimpiezaInvitados = {
  reclamadas: number;
  eliminadas: number;
};

/**
 * Reclama un lote privado y borra sus usuarios técnicos mediante Auth Admin.
 * La base bloquea atómicamente una conversión una vez entregado el claim. Esta
 * segunda lectura evita además borrar una cuenta que ya no sea anónima ante
 * estados legados o una regresión del trigger. Los fallos quedan para retry.
 */
export async function limpiarIdentidadesInvitadasPendientes(
  admin: ClienteLimpiezaInvitados,
  opciones: OpcionesLimpieza = {}
): Promise<ResultadoLimpiezaInvitados> {
  const limite = Math.min(Math.max(Math.trunc(opciones.limite ?? 3), 1), 10);
  const preferida =
    opciones.preferida && UUID.test(opciones.preferida)
      ? opciones.preferida
      : null;

  const { data, error } = await admin.rpc(
    "tomar_limpiezas_identidad_invitada",
    {
      p_limite: limite,
      p_preferida: preferida,
    }
  );

  if (error) {
    console.error(
      "[auth] No se pudieron reclamar limpiezas de invitados:",
      error
    );
    return { reclamadas: 0, eliminadas: 0 };
  }

  const ids = Array.isArray(data)
    ? data.flatMap((fila) => {
        if (
          typeof fila === "object" &&
          fila !== null &&
          "guest_user_id" in fila &&
          typeof fila.guest_user_id === "string" &&
          UUID.test(fila.guest_user_id)
        ) {
          return [fila.guest_user_id];
        }
        return [];
      })
    : [];

  let eliminadas = 0;
  for (const id of ids) {
    const {
      data: { user },
      error: errorVerificacion,
    } = await admin.auth.admin.getUserById(id);
    if (errorVerificacion) {
      console.error(
        "[auth] No se pudo revalidar una identidad invitada encolada:",
        errorVerificacion
      );
      continue;
    }
    if (user?.is_anonymous !== true) {
      continue;
    }

    const { error: errorBorrado } = await admin.auth.admin.deleteUser(id);
    if (errorBorrado) {
      console.error(
        "[auth] No se pudo eliminar una identidad invitada encolada:",
        errorBorrado
      );
    } else {
      eliminadas += 1;
    }
  }

  return { reclamadas: ids.length, eliminadas };
}
