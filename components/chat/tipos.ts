export type CitaUI = {
  titulo: string;
  pagina?: number | null;
};

export type PreguntaGuiadaUI = {
  texto: string;
  opciones: string[];
};

import type { EstadoConEtiqueta } from "@/lib/chat/contrato";

export type MensajeUI = {
  id: string;
  sender: "usuario" | "asistente" | "sistema";
  content: string;
  estado?: EstadoConEtiqueta;
  citas: CitaUI[];
  preguntaGuiada?: PreguntaGuiadaUI;
};
