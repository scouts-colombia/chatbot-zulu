import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ERROR_COORDINACION_INVITADA } from "@/lib/invitados/coordinacion";
import {
  construirMensajeAsistente,
  decidirFallo,
  decidirPreparacionInvitada,
  decidirTurno,
  MOTIVOS_REGISTRO,
} from "./decisiones-turno";

const CONVERSACION = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("preparación de la sesión de prueba", () => {
  it("entrega el id de conversación cuando el servidor la preparó", () => {
    const { decision, revertir } = decidirPreparacionInvitada(true, {
      sesionPreparada: true,
      conversationId: CONVERSACION,
    });
    assert.deepEqual(decision, {
      tipo: "sesion_invitada_lista",
      conversationId: CONVERSACION,
    });
    assert.equal(revertir, false);
  });

  it("no confía en un id de conversación que no sea un UUID propio", () => {
    for (const conversationId of [
      "../../../otra",
      "",
      42,
      null,
      undefined,
      "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    ]) {
      const { decision, revertir } = decidirPreparacionInvitada(true, {
        sesionPreparada: true,
        conversationId,
      });
      assert.equal(decision.tipo, "aviso", `aceptó ${String(conversationId)}`);
      assert.equal(revertir, true);
    }
  });

  it("propaga la puerta de registro cuando el cupo ya estaba agotado", () => {
    const { decision, revertir } = decidirPreparacionInvitada(false, {
      codigo: "registro_requerido",
      mensaje: "Ya usaste tu pregunta de prueba.",
    });
    assert.deepEqual(decision, {
      tipo: "registro",
      mensaje: "Ya usaste tu pregunta de prueba.",
    });
    assert.equal(revertir, true);
  });

  it("cae en un aviso genérico si el servidor no explica el fallo", () => {
    const { decision, revertir } = decidirPreparacionInvitada(false, null);
    assert.equal(decision.tipo, "aviso");
    assert.match(
      decision.tipo === "aviso" ? decision.mensaje : "",
      /sesión de prueba/
    );
    assert.equal(revertir, true);
  });
});

describe("resultado del turno", () => {
  it("acepta la respuesta cuando el servidor la confirmó", () => {
    const cuerpo = { estado: "respondido", respuesta: "Hola" };
    const { decision, revertir } = decidirTurno({
      ok: true,
      cuerpo,
      esInvitado: true,
    });
    assert.deepEqual(decision, { tipo: "respuesta", cuerpo });
    assert.equal(revertir, false);
  });

  it("conserva la burbuja cuando el turno de prueba ya se consumió", () => {
    const { decision, revertir } = decidirTurno({
      ok: false,
      cuerpo: {
        codigo: "turno_invitado_consumido",
        mensaje: "Tu pregunta quedó registrada.",
      },
      esInvitado: true,
    });
    assert.deepEqual(decision, {
      tipo: "aviso",
      mensaje: "Tu pregunta quedó registrada.",
    });
    // La cuota se gastó: retirar la burbuja mentiría sobre lo que pasó.
    assert.equal(revertir, false);
  });

  it("trata turno_invitado_consumido como error normal en una cuenta permanente", () => {
    const { decision, revertir } = decidirTurno({
      ok: false,
      cuerpo: { codigo: "turno_invitado_consumido", mensaje: "algo" },
      esInvitado: false,
    });
    assert.deepEqual(decision, { tipo: "aviso", mensaje: "algo" });
    assert.equal(revertir, true);
  });

  it("lleva el id de conversación del límite a la puerta de registro", () => {
    const { decision } = decidirTurno({
      ok: false,
      cuerpo: {
        codigo: "registro_requerido",
        mensaje: "Ya usaste tu pregunta de prueba.",
        conversationId: CONVERSACION,
      },
      esInvitado: true,
    });
    assert.deepEqual(decision, {
      tipo: "registro",
      mensaje: "Ya usaste tu pregunta de prueba.",
      conversationId: CONVERSACION,
    });
  });

  it("usa el motivo por defecto si el límite no trae mensaje", () => {
    const { decision } = decidirTurno({
      ok: false,
      cuerpo: { codigo: "registro_requerido" },
      esInvitado: true,
    });
    assert.deepEqual(decision, {
      tipo: "registro",
      mensaje: MOTIVOS_REGISTRO.cupoAgotado,
      conversationId: undefined,
    });
  });

  it("reintenta la sesión de prueba cuando el servidor la desconoce", () => {
    const { decision, revertir } = decidirTurno({
      ok: false,
      cuerpo: { codigo: "sesion_invitada_requerida" },
      esInvitado: true,
    });
    assert.equal(decision.tipo, "reintentar_sesion_invitada");
    assert.equal(revertir, true);
  });

  it("ofrece conservar la pregunta si el error del invitado no trae cuerpo", () => {
    // Un 500 sin cuerpo o un 504 del gateway devuelven HTML: el turno pudo
    // consumirse igual, así que no se promete un reintento limpio.
    const { decision, revertir } = decidirTurno({
      ok: false,
      cuerpo: null,
      esInvitado: true,
    });
    assert.deepEqual(decision, {
      tipo: "registro",
      mensaje: MOTIVOS_REGISTRO.respuestaSinConfirmar,
    });
    assert.equal(revertir, true);
  });

  it("a una cuenta permanente le ofrece reintentar, no registrarse", () => {
    const { decision } = decidirTurno({
      ok: false,
      cuerpo: null,
      esInvitado: false,
    });
    assert.equal(decision.tipo, "aviso");
  });

  it("no da por buena una respuesta 200 sin cuerpo", () => {
    const invitado = decidirTurno({
      ok: true,
      cuerpo: null,
      esInvitado: true,
    });
    assert.equal(invitado.decision.tipo, "registro");
    assert.equal(invitado.revertir, true);

    const registrado = decidirTurno({
      ok: true,
      cuerpo: null,
      esInvitado: false,
    });
    assert.equal(registrado.decision.tipo, "aviso");
    assert.equal(registrado.revertir, true);
  });
});

describe("fallo antes de tener respuesta", () => {
  it("distingue el bloqueo entre pestañas de una caída de red", () => {
    const sinLocks = decidirFallo({
      error: new Error(ERROR_COORDINACION_INVITADA),
      esInvitado: true,
      solicitudPrincipalIniciada: false,
    });
    assert.deepEqual(sinLocks.decision, {
      tipo: "registro",
      mensaje: MOTIVOS_REGISTRO.sinCoordinacion,
    });
  });

  it("ofrece conservar la pregunta si la conexión cayó ya enviada", () => {
    const { decision } = decidirFallo({
      error: new Error("network"),
      esInvitado: true,
      solicitudPrincipalIniciada: true,
    });
    assert.deepEqual(decision, {
      tipo: "registro",
      mensaje: MOTIVOS_REGISTRO.conexionPerdida,
    });
  });

  it("avisa sin más si nunca se llegó a enviar", () => {
    const { decision, revertir } = decidirFallo({
      error: new Error("network"),
      esInvitado: true,
      solicitudPrincipalIniciada: false,
    });
    assert.equal(decision.tipo, "aviso");
    assert.equal(revertir, true);
  });

  it("una cuenta permanente nunca ve la puerta de registro", () => {
    const { decision } = decidirFallo({
      error: new Error("network"),
      esInvitado: false,
      solicitudPrincipalIniciada: true,
    });
    assert.equal(decision.tipo, "aviso");
  });
});

describe("burbuja del asistente", () => {
  it("normaliza citas y pregunta guiada", () => {
    const mensaje = construirMensajeAsistente(
      {
        mensajeId: "m1",
        estado: "necesita_aclaracion",
        respuesta: "¿A qué rama te refieres?",
        citas: [{ documentTitleSnapshot: "Manual Rover", pageNumber: 12 }],
        preguntaGuiada: { texto: "Elige", opciones: ["Clan", "Manada"] },
      },
      "respaldo"
    );
    assert.equal(mensaje.id, "m1");
    assert.equal(mensaje.estado, "necesita_aclaracion");
    assert.deepEqual(mensaje.citas, [{ titulo: "Manual Rover", pagina: 12 }]);
    assert.deepEqual(mensaje.preguntaGuiada, {
      texto: "Elige",
      opciones: ["Clan", "Manada"],
    });
  });

  it("no etiqueta el estado normal y tolera una respuesta sin adjuntos", () => {
    const mensaje = construirMensajeAsistente(
      { estado: "respondido", respuesta: "Listo" },
      "respaldo"
    );
    assert.equal(mensaje.id, "respaldo");
    assert.equal(mensaje.estado, undefined);
    assert.deepEqual(mensaje.citas, []);
    assert.equal(mensaje.preguntaGuiada, undefined);
  });
});
