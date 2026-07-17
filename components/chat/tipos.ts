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
  estado?: string;
  citas: CitaUI[];
  preguntaGuiada?: PreguntaGuiadaUI;
};
