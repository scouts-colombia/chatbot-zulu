import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolverConfiguracionChat } from "./chat";

test("la configuración de base es la única fuente operativa", () => {
  const configuracion = resolverConfiguracionChat([
    { clave: "gemini_model", valor: "gemini-prueba" },
    { clave: "gemini_thinking_level", valor: "high" },
    { clave: "max_chat_turns_per_user_per_day", valor: "40" },
    { clave: "max_guest_turns_per_person_per_day", valor: "3" },
    { clave: "max_guest_turns_per_network", valor: "20" },
  ]);

  assert.deepEqual(configuracion, {
    modelo: "gemini-prueba",
    nivelRazonamiento: "high",
    maxTurnosRegistradoPorDia: 40,
    maxTurnosInvitadoPorPersonaPorDia: 3,
    maxTurnosInvitadoPorRedPorDia: 20,
  });
});

test("rechaza la configuración incompleta o inválida", () => {
  const configuracion = resolverConfiguracionChat([
    { clave: "gemini_model", valor: "modelo-invalido" },
    { clave: "gemini_thinking_level", valor: "extreme" },
    { clave: "max_chat_turns_per_user_per_day", valor: "0" },
    { clave: "max_guest_turns_per_person_per_day", valor: "99" },
    { clave: "max_guest_turns_per_network", valor: "NaN" },
  ]);

  assert.equal(configuracion, null);
  assert.equal(resolverConfiguracionChat([]), null);
});

test("la migración reemplaza la unicidad por cuotas y audita el guardado", () => {
  const migracion = readFileSync(
    "supabase/migrations/20260819030751_configuracion_operativa_admin.sql",
    "utf8"
  );

  assert.match(
    migracion,
    /drop constraint if exists guest_turn_reservations_device_hash_key/
  );
  assert.match(migracion, /primary key \(user_message_id\)/);
  assert.match(
    migracion,
    /where \(anonymous_user_id = p_user_id or device_hash = p_device_hash\)/
  );
  assert.match(migracion, /'update_chat_settings'/);
  assert.match(migracion, /\('gemini_model', 'gemini-3\.5-flash'\)/);
  assert.match(
    migracion,
    /grant execute on function public\.admin_actualizar_configuracion_chat/
  );
});
