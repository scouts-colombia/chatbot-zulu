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

/**
 * Versión oficial por documento. Cada manual tiene la suya (el Manual de Cargos
 * declara "Segunda edición: 2024", el Reglamento de Asambleas se reformó por
 * Acuerdo C.S.N. Nº 556 de 2022), así que una sola `--version` para toda la
 * corrida etiquetaría mal las citas. `--version` queda como respaldo para los
 * archivos que no estén en el mapa.
 */
const VERSIONES: Record<string, string> = JSON.parse(
  readFileSync(resolve("scripts/versiones-documentos.json"), "utf8")
);

/**
 * La búsqueda normaliza a NFC y no distingue mayúsculas en la extensión: un
 * PDF que venga de macOS trae los acentos descompuestos (NFD) y no casaría con
 * la clave del JSON, y `Manual.PDF` tampoco. Un fallo silencioso aquí escribe
 * una versión inventada en la fila, en el proveedor y en el chip que lee el
 * Scout, así que un archivo fuera del mapa se avisa en voz alta.
 */
function versionDe(archivo: string) {
  const clave = archivo.normalize("NFC").toLowerCase();
  for (const [nombre, version] of Object.entries(VERSIONES)) {
    if (nombre.startsWith("_")) {
      continue;
    }
    if (nombre.normalize("NFC").toLowerCase() === clave) {
      return version;
    }
  }
  console.warn(
    `AVISO    ${archivo} no está en scripts/versiones-documentos.json; se usará la versión "${VERSION}"`
  );
  return VERSION;
}

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

/**
 * El nombre del archivo ES el título visible: los PDFs oficiales ya vienen con
 * su nombre correcto y ese texto es lo que el Scout lee en las citas.
 *
 * Antes se capitalizaba cada palabra con `/\b\w/g`, que en JavaScript no trata
 * las vocales acentuadas como caracteres de palabra: "Guía para el Dirigente de
 * Clan" salía como "GuíA Para El Dirigente De Clan" y "Jóvenes" como "JóVenes".
 * Solo se recorta el espacio sobrante.
 */
function nombreVisible(archivo: string) {
  return basename(archivo, ".pdf").replace(/\s+/g, " ").trim();
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

/**
 * Borra del store el documento que declare este `knowledge_document_id`, si
 * existe. El SDK no ofrece update ni upsert de documentos (solo list/get/
 * delete), así que reindexar es borrar y volver a subir; sin el borrado el
 * store acumula copias del mismo manual en cada corrida con FORCE=1.
 *
 * Se localiza listando el store y cruzando por metadata en vez de por
 * `file_search_document_name`, porque las filas indexadas antes de arreglar la
 * lectura de `documentName` lo tienen en null.
 */
async function borrarDocumentoRemoto(
  storeName: string,
  knowledgeDocumentId: string
) {
  const pager = await ai.fileSearchStores.documents.list({
    parent: storeName,
    config: { pageSize: 20 },
  });
  for await (const documento of pager) {
    const id = documento.customMetadata?.find(
      (m) => m.key === "knowledge_document_id"
    )?.stringValue;
    if (id === knowledgeDocumentId && documento.name) {
      await ai.fileSearchStores.documents.delete({
        name: documento.name,
        config: { force: true },
      });
      console.log(
        `RETIRADO del store el documento anterior (${documento.name})`
      );
    }
  }
}

async function indexarArchivo(storeName: string, archivo: string) {
  const ruta = join(CARPETA_PDFS, archivo);
  const sha256 = createHash("sha256").update(readFileSync(ruta)).digest("hex");
  const displayName = nombreVisible(archivo);

  const version = versionDe(archivo);

  // 1) Reservar/reutilizar la fila local ANTES de importar.
  const { data: existente, error: errorExistente } = await supabase
    .from("knowledge_documents")
    .select("id, metadata_synced_at, version, display_name, active")
    .eq("sha256", sha256)
    .maybeSingle();
  // Sin esto, dos filas con el mismo sha (no hay unique) devuelven error con
  // data null y el PDF se trataría como nuevo, insertando una tercera.
  if (errorExistente) {
    throw new Error(
      `No se pudo consultar la fila por sha256: ${errorExistente.message}`
    );
  }

  // El título y la versión se reconcilian SIEMPRE, aunque el PDF no haya
  // cambiado: si se corrige la capitalización del nombre o una versión del
  // mapa, ese cambio tiene que llegar a la fila. Antes el return temprano
  // saltaba incluso este update.
  if (existente) {
    const cambios: Record<string, string> = {};
    if (existente.display_name !== displayName) {
      cambios.display_name = displayName;
    }
    if (existente.version !== version) {
      cambios.version = version;
    }
    if (Object.keys(cambios).length > 0) {
      const { error } = await supabase
        .from("knowledge_documents")
        .update(cambios)
        .eq("id", existente.id);
      if (error) {
        throw new Error(`No se pudo reconciliar la fila: ${error.message}`);
      }
      console.log(
        `ACTUALIZADO ${displayName} en la base (${Object.keys(cambios).join(", ")})`
      );
    }
  }

  if (existente?.metadata_synced_at && !FORZAR) {
    // El displayName y el customMetadata viajan dentro del documento del
    // proveedor y no se pueden editar en sitio (el SDK solo ofrece
    // list/get/delete), así que alinearlos exige borrar y volver a subir.
    const desalineado =
      existente.display_name !== displayName || existente.version !== version;
    console.log(
      desalineado
        ? `OMITIDO  ${displayName} (fila corregida; el documento del proveedor sigue con los valores viejos — FORCE=1 para reindexarlo)`
        : `OMITIDO  ${displayName} (ya indexado; FORCE=1 para repetir)`
    );
    return;
  }

  let knowledgeDocumentId = existente?.id as string | undefined;
  if (!knowledgeDocumentId) {
    const { data: creado, error } = await supabase
      .from("knowledge_documents")
      .insert({
        display_name: displayName,
        version: versionDe(archivo),
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
  // Antes hay que retirar del proveedor el documento anterior de este mismo
  // knowledge_document_id: subir no reemplaza, crea otro documento con nombre
  // aleatorio, y ambos declararían el mismo id en su metadata, así que los dos
  // pasarían el metadataFilter y el grounding podría citar la copia vieja.
  await borrarDocumentoRemoto(storeName, knowledgeDocumentId);

  console.log(`Indexando ${displayName} ...`);
  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file: ruta,
    fileSearchStoreName: storeName,
    config: {
      displayName,
      customMetadata: [
        { key: "knowledge_document_id", stringValue: knowledgeDocumentId },
        // La versión sale SIEMPRE del mapa: la fila es una copia, el mapa es
        // la fuente. Con `existente?.version` una corrección nunca llegaba.
        { key: "document_version", stringValue: version },
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

  // done=true puede venir con error: en ese caso NO se marca activo.
  if (operation.error) {
    throw new Error(
      `La operación de indexación falló: ${JSON.stringify(operation.error).slice(0, 300)}`
    );
  }

  // El SDK devuelve UploadToFileSearchStoreResponse { parent, documentName }.
  // Antes se leía `response.document.name`, que no existe, así que la columna
  // quedaba siempre en null y la fila se quedaba sin puntero al documento del
  // proveedor (sin él no se puede borrar ni auditar desde la base).
  const documentName =
    (operation.response as { documentName?: string } | undefined)
      ?.documentName ?? null;

  // 3) Confirmar la sincronización local.
  const { error: errorUpdate } = await supabase
    .from("knowledge_documents")
    .update({
      active: true,
      display_name: displayName,
      version,
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

  // 4) Retirar versiones anteriores del mismo documento (mismo display_name,
  // distinto sha256): active=false las excluye del metadataFilter del chat,
  // y las citas históricas conservan su snapshot. El versionado completo es
  // P1; este retiro evita citar versiones obsoletas junto a la nueva.
  const { data: retiradas } = await supabase
    .from("knowledge_documents")
    .update({ active: false })
    .eq("display_name", displayName)
    .eq("active", true)
    .neq("id", knowledgeDocumentId)
    .select("id");
  for (const retirada of retiradas ?? []) {
    console.log(`RETIRADA versión anterior (id=${retirada.id})`);
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
  console.log(`Store: ${storeName} — ${archivos.length} PDF(s)`);
  for (const archivo of archivos) {
    console.log(`  · ${nombreVisible(archivo)} → v${versionDe(archivo)}`);
  }
  console.log("");

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
