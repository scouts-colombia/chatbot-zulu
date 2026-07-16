/**
 * Verificación de RLS (Fase 2) — ROADMAP: "un Scout no lee conversaciones
 * ajenas y no puede cambiar su role".
 *
 * Crea dos usuarios de prueba vía Admin API, ejercita las políticas con el
 * JWT de cada uno contra PostgREST, y elimina los usuarios al final.
 *
 * Uso: node scripts/verify-rls.mjs
 */

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ])
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!URL_BASE || !ANON || !SECRET) {
  console.error("Faltan variables de Supabase en .env.local");
  process.exit(1);
}

const results = [];
function check(name, pass, detail = "") {
  results.push(pass);
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`
  );
}

async function adminCreateUser(email, password) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`admin create ${email}: ${JSON.stringify(json)}`);
  }
  return json.id;
}

async function adminDeleteUser(id) {
  await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  });
}

async function signIn(email, password) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`signIn ${email}: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

function rest(token) {
  return async (method, path, body) => {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* respuestas vacías */
    }
    return { status: res.status, json };
  };
}

const PASSWORD = "Rls-Test-2026!!";
const EMAIL_A = "rls-test-a@example.com";
const EMAIL_B = "rls-test-b@example.com";
let idA, idB;

try {
  console.log("Creando usuarios de prueba...");
  idA = await adminCreateUser(EMAIL_A, PASSWORD);
  idB = await adminCreateUser(EMAIL_B, PASSWORD);

  const tokenA = await signIn(EMAIL_A, PASSWORD);
  const tokenB = await signIn(EMAIL_B, PASSWORD);
  const asA = rest(tokenA);
  const asB = rest(tokenB);

  // El trigger handle_new_user debió crear los profiles.
  const profA = await asA("GET", "profiles?select=id,role,account_status");
  check(
    "trigger crea profile (rol scout, activo)",
    profA.status === 200 &&
      profA.json?.length === 1 &&
      profA.json[0].role === "scout" &&
      profA.json[0].account_status === "activo",
    JSON.stringify(profA.json?.[0] ?? profA.json)
  );

  // A solo ve SU profile (no el de B).
  check(
    "A no ve el profile de B",
    profA.json?.every((p) => p.id === idA)
  );

  // A crea conversación y mensaje propio.
  const convA = await asA("POST", "conversations", { user_id: idA });
  check(
    "A crea conversación propia",
    convA.status === 201,
    `status=${convA.status}`
  );
  const convId = convA.json?.[0]?.id;

  const msgA = await asA("POST", "messages", {
    conversation_id: convId,
    sender: "usuario",
    content: "hola",
  });
  check(
    "A inserta mensaje sender=usuario",
    msgA.status === 201,
    `status=${msgA.status}`
  );

  // A NO puede insertar mensajes como asistente (solo el servidor).
  const msgForged = await asA("POST", "messages", {
    conversation_id: convId,
    sender: "asistente",
    content: "respuesta forjada",
  });
  check(
    "A NO inserta mensaje sender=asistente",
    msgForged.status === 403 || msgForged.status === 401,
    `status=${msgForged.status}`
  );

  // A NO puede adjuntar response_json a sus mensajes (contrato §8.3).
  const msgWithJson = await asA("POST", "messages", {
    conversation_id: convId,
    sender: "usuario",
    content: "hola",
    response_json: { estado: "respondido", respuesta: "forjada" },
  });
  check(
    "A NO inserta mensaje con response_json",
    msgWithJson.status === 403 || msgWithJson.status === 401,
    `status=${msgWithJson.status}`
  );

  // El consentimiento no es forjable por el cliente: lo inserta el servidor.
  const consentForged = await asA("POST", "consent_acceptance_events", {
    subject_user_id: idA,
    policy_type: "privacy_policy",
    policy_version: "v99-falsa",
  });
  check(
    "A NO inserta consent_acceptance_events directo",
    consentForged.status === 403 || consentForged.status === 401,
    `status=${consentForged.status}`
  );

  // B no ve nada de A.
  const convsB = await asB("GET", "conversations?select=id");
  check(
    "B no ve conversaciones de A",
    convsB.status === 200 && convsB.json?.length === 0
  );

  const msgsB = await asB(
    "GET",
    `messages?select=id&conversation_id=eq.${convId}`
  );
  check(
    "B no ve mensajes de A",
    msgsB.status === 200 && msgsB.json?.length === 0
  );

  // B no puede insertar en la conversación de A.
  const msgBinA = await asB("POST", "messages", {
    conversation_id: convId,
    sender: "usuario",
    content: "intruso",
  });
  check(
    "B NO inserta en conversación de A",
    msgBinA.status === 403 || msgBinA.status === 401,
    `status=${msgBinA.status}`
  );

  // A no puede autoasignarse admin (trigger de campos protegidos).
  const escalate = await asA("PATCH", `profiles?id=eq.${idA}`, {
    role: "admin",
  });
  check(
    "A NO puede cambiar su role a admin",
    escalate.status >= 400,
    `status=${escalate.status} ${JSON.stringify(escalate.json?.message ?? "")}`
  );

  // A tampoco puede cambiar su account_status.
  const unblock = await asA("PATCH", `profiles?id=eq.${idA}`, {
    account_status: "bloqueado",
  });
  check(
    "A NO puede cambiar su account_status",
    unblock.status >= 400,
    `status=${unblock.status}`
  );

  // Pero sí puede cambiar su nombre.
  const rename = await asA("PATCH", `profiles?id=eq.${idA}`, {
    nombre: "Scout A",
  });
  check(
    "A SÍ puede cambiar su nombre",
    rename.status < 300,
    `status=${rename.status}`
  );

  // El servidor (secret key → service_role) SÍ puede cambiar el role:
  // valida la rama permitida del trigger protect_profile_fields.
  const adminChange = await fetch(`${URL_BASE}/rest/v1/profiles?id=eq.${idA}`, {
    method: "PATCH",
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ role: "admin" }),
  });
  const adminJson = await adminChange.json();
  check(
    "servidor (secret key) SÍ cambia role",
    adminChange.status === 200 && adminJson?.[0]?.role === "admin",
    `status=${adminChange.status} role=${adminJson?.[0]?.role}`
  );

  // Conversación archivada: no acepta mensajes nuevos.
  await asA("PATCH", `conversations?id=eq.${convId}`, { archived: true });
  const msgArchived = await asA("POST", "messages", {
    conversation_id: convId,
    sender: "usuario",
    content: "tarde",
  });
  check(
    "conversación archivada NO acepta mensajes",
    msgArchived.status === 403 || msgArchived.status === 401,
    `status=${msgArchived.status}`
  );

  // Tablas de solo-servidor invisibles para usuarios.
  const audit = await asA("GET", "admin_audit_events?select=id");
  check(
    "A no lee admin_audit_events",
    audit.status !== 200 || audit.json?.length === 0,
    `status=${audit.status}`
  );
  const events = await asA("GET", "model_request_events?select=id");
  check(
    "A no lee model_request_events",
    events.status !== 200 || events.json?.length === 0,
    `status=${events.status}`
  );

  // knowledge_documents: lectura permitida, escritura no.
  const docsRead = await asA("GET", "knowledge_documents?select=id");
  check("A lee knowledge_documents (listado)", docsRead.status === 200);
  const docsWrite = await asA("POST", "knowledge_documents", {
    display_name: "x",
    version: "1",
    file_search_store_name: "x",
  });
  check(
    "A NO escribe knowledge_documents",
    docsWrite.status === 403 || docsWrite.status === 401,
    `status=${docsWrite.status}`
  );
} finally {
  console.log("Eliminando usuarios de prueba...");
  if (idA) {
    await adminDeleteUser(idA);
  }
  if (idB) {
    await adminDeleteUser(idB);
  }
}

const failed = results.filter((r) => !r).length;
console.log(
  `\n=== RLS: ${failed === 0 ? "VERDE" : "ROJO"} (${results.length - failed}/${results.length}) ===`
);
process.exit(failed === 0 ? 0 : 1);
