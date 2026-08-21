import type { EstadoConEtiqueta } from "@/lib/chat/contrato";

export type ConversacionListado = {
  id: string;
  title: string;
};

export type CitaUI = {
  titulo: string;
  pagina?: number | null;
};

export type PreguntaGuiadaUI = {
  texto: string;
  opciones: string[];
};

export type MensajeUI = {
  id: string;
  sender: "usuario" | "asistente" | "sistema";
  content: string;
  estado?: EstadoConEtiqueta;
  citas: CitaUI[];
  preguntaGuiada?: PreguntaGuiadaUI;
};
