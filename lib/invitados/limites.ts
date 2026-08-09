export function respuestaRegistroPorLimite(mensajeError: string) {
  return {
    codigo: "registro_requerido" as const,
    mensaje: mensajeError.includes("limite_red_invitada")
      ? "El cupo de preguntas de prueba de esta red se agotó por hoy. Crea una cuenta o inicia sesión para continuar."
      : "Ya usaste tu pregunta de prueba. Crea una cuenta o inicia sesión para continuar.",
  };
}
