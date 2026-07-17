/**
 * Indexación de documentos oficiales en Gemini File Search (pilot-scope §13.1).
 *
 * Flujo por PDF en data/pdfs/:
 *   1. Calcula SHA-256.
 *   2. Crea o reserva la fila en knowledge_documents ANTES de importar (D-07).
 *   3. Sube al store adjuntando custom_metadata con knowledge_document_id,
 *      document_version y sha256.
 *   4. Actualiza la fila con store, documento, indexed_at y metadata_synced_at.
 *
 * Si un documento ya está indexado (mismo sha256 con metadata sincronizada),
 * se omite salvo FORCE=1.
 *
 * Uso: pnpm exec tsx scripts/index-knowledge-documents.ts [--version <v>]
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const CARPETA_PDFS = resolve("data/pdfs");
const STORE_DISPLAY_NAME = "chatbot-zulu-piloto";

const indiceVersion = process.argv.indexOf("--version");
const VERSION =
  indiceVersion > -1 ? process.argv[indiceVersion + 1] : "piloto-v1";
const FORZAR = process.env.FORCE === "1";

const { GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } =
  process.env;
if (!(GEMINI_API_KEY && NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SECRET_KEY)) {
  console.error(
    "Faltan GEMINI_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY en .env.local"
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function nombreVisible(archivo: string) {
  return basename(archivo, ".pdf")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

async function obtenerOCrearStore() {
  const pager = await ai.fileSearchStores.list();
  for await (const store of pager) {
    if (store.displayName === STORE_DISPLAY_NAME && store.name) {
      return store.name;
    }
  }
  const store = await ai.fileSearchStores.create({
    config: { displayName: STORE_DISPLAY_NAME },
  });
  if (!store.name) {
    throw new Error("El store creado no devolvió name");
  }
  console.log(`Store creado: ${store.name}`);
  return store.name;
}

async function indexarArchivo(storeName: string, archivo: string) {
  const ruta = join(CARPETA_PDFS, archivo);
  const sha256 = createHash("sha256").update(readFileSync(ruta)).digest("hex");
  const displayName = nombreVisible(archivo);

  // 1) Reservar/reutilizar la fila local ANTES de importar.
  const { data: existente } = await supabase
    .from("knowledge_documents")
    .select("id, metadata_synced_at, version")
    .eq("sha256", sha256)
    .maybeSingle();

  if (existente?.metadata_synced_at && !FORZAR) {
    console.log(`OMITIDO  ${displayName} (ya indexado; FORCE=1 para repetir)`);
    return;
  }

  let knowledgeDocumentId = existente?.id as string | undefined;
  if (!knowledgeDocumentId) {
    const { data: creado, error } = await supabase
      .from("knowledge_documents")
      .insert({
        display_name: displayName,
        version: VERSION,
        active: false,
        file_search_store_name: storeName,
        sha256,
      })
      .select("id")
      .single();
    if (error || !creado) {
      throw new Error(`No se pudo reservar la fila: ${error?.message}`);
    }
    knowledgeDocumentId = creado.id as string;
  }

  // 2) Importar con custom_metadata (regla P0 de D-07).
  console.log(`Indexando ${displayName} ...`);
  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: ruta,
    fileSearchStoreName: storeName,
    config: {
      displayName,
      customMetadata: [
        { key: "knowledge_document_id", stringValue: knowledgeDocumentId },
        { key: "document_version", stringValue: existente?.version ?? VERSION },
        { key: "sha256", stringValue: sha256 },
      ],
    },
  });
  const inicio = Date.now();
  while (!operation.done) {
    if (Date.now() - inicio > 300_000) {
      throw new Error("Timeout indexando (300s)");
    }
    await new Promise((r) => setTimeout(r, 4000));
    operation = await ai.operations.get({ operation });
  }

  const documentName =
    (operation.response as { document?: { name?: string } } | undefined)
      ?.document?.name ?? null;

  // 3) Confirmar la sincronización local.
  const { error: errorUpdate } = await supabase
    .from("knowledge_documents")
    .update({
      active: true,
      file_search_store_name: storeName,
      file_search_document_name: documentName,
      indexed_at: new Date().toISOString(),
      metadata_synced_at: new Date().toISOString(),
      last_index_error: null,
    })
    .eq("id", knowledgeDocumentId);
  if (errorUpdate) {
    throw new Error(`No se pudo confirmar la fila: ${errorUpdate.message}`);
  }

  console.log(
    `OK       ${displayName} (id=${knowledgeDocumentId}, ${Math.round((Date.now() - inicio) / 1000)}s)`
  );
}

async function main() {
  const archivos = readdirSync(CARPETA_PDFS).filter((archivo) =>
    archivo.toLowerCase().endsWith(".pdf")
  );
  if (archivos.length === 0) {
    console.error(`No hay PDFs en ${CARPETA_PDFS}`);
    process.exit(1);
  }

  const storeName = await obtenerOCrearStore();
  console.log(
    `Store: ${storeName} — ${archivos.length} PDF(s), versión ${VERSION}\n`
  );

  let fallidos = 0;
  for (const archivo of archivos) {
    try {
      await indexarArchivo(storeName, archivo);
    } catch (error) {
      fallidos++;
      const mensaje = error instanceof Error ? error.message : String(error);
      console.error(`FALLO    ${archivo}: ${mensaje}`);
      await supabase
        .from("knowledge_documents")
        .update({ last_index_error: mensaje.slice(0, 500) })
        .eq(
          "sha256",
          createHash("sha256")
            .update(readFileSync(join(CARPETA_PDFS, archivo)))
            .digest("hex")
        );
    }
  }

  process.exit(fallidos === 0 ? 0 : 1);
}

main();
