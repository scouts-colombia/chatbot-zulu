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

const enteroSeguro = (
  valor: string | undefined,
  minimo: number,
  maximo: number,
  predeterminado: number
) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo
    ? numero
    : predeterminado;
};

export function resolverConfiguracionChat(
  filas: FilaConfiguracion[] = [],
  entorno: Record<string, string | undefined> = process.env
): ConfiguracionChat {
  const valores = new Map(filas.map(({ clave, valor }) => [clave, valor]));
  const modeloEntorno = entorno.GEMINI_MODEL ?? "gemini-3.5-flash";
  const modelo = ConfiguracionChatSchema.shape.modelo.safeParse(
    valores.get("gemini_model") ?? modeloEntorno
  );
  const nivel = ConfiguracionChatSchema.shape.nivelRazonamiento.safeParse(
    valores.get("gemini_thinking_level") ?? entorno.GEMINI_THINKING_LEVEL
  );

  return {
    modelo: modelo.success ? modelo.data : "gemini-3.5-flash",
    nivelRazonamiento: nivel.success ? nivel.data : "medium",
    maxTurnosRegistradoPorDia: enteroSeguro(
      valores.get("max_chat_turns_per_user_per_day"),
      1,
      500,
      30
    ),
    maxTurnosInvitadoPorPersonaPorDia: enteroSeguro(
      valores.get("max_guest_turns_per_person_per_day"),
      1,
      10,
      1
    ),
    maxTurnosInvitadoPorRedPorDia: enteroSeguro(
      valores.get("max_guest_turns_per_network"),
      1,
      500,
      5
    ),
  };
}
