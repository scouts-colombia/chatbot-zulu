import { z } from "zod";

export const NIVELES_RAZONAMIENTO = [
  "minimal",
  "low",
  "medium",
  "high",
] as const;

export type NivelRazonamientoGemini = (typeof NIVELES_RAZONAMIENTO)[number];

export const CLAVES_CONFIGURACION_CHAT = [
  "gemini_model",
  "gemini_thinking_level",
  "max_chat_turns_per_user_per_day",
  "max_guest_turns_per_person_per_day",
  "max_guest_turns_per_network",
] as const;

export const ConfiguracionChatSchema = z.object({
  modelo: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^gemini-[a-z0-9][a-z0-9.-]*$/),
  nivelRazonamiento: z.enum(NIVELES_RAZONAMIENTO),
  maxTurnosRegistradoPorDia: z.coerce.number().int().min(1).max(500),
  maxTurnosInvitadoPorPersonaPorDia: z.coerce.number().int().min(1).max(10),
  maxTurnosInvitadoPorRedPorDia: z.coerce.number().int().min(1).max(500),
});

export type ConfiguracionChat = z.infer<typeof ConfiguracionChatSchema>;

type FilaConfiguracion = { clave: string; valor: string };

export function resolverConfiguracionChat(
  filas: FilaConfiguracion[] = []
): ConfiguracionChat | null {
  const valores = new Map(filas.map(({ clave, valor }) => [clave, valor]));
  const resultado = ConfiguracionChatSchema.safeParse({
    modelo: valores.get("gemini_model"),
    nivelRazonamiento: valores.get("gemini_thinking_level"),
    maxTurnosRegistradoPorDia: valores.get("max_chat_turns_per_user_per_day"),
    maxTurnosInvitadoPorPersonaPorDia: valores.get(
      "max_guest_turns_per_person_per_day"
    ),
    maxTurnosInvitadoPorRedPorDia: valores.get("max_guest_turns_per_network"),
  });

  return resultado.success ? resultado.data : null;
}
