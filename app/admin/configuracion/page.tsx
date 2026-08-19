import { Settings2 } from "lucide-react";
import { Suspense } from "react";
import { requerirAdmin } from "@/lib/admin/guard";
import { cargarConfiguracionChat } from "@/lib/configuracion/servidor";
import { FormularioConfiguracion } from "./formulario-configuracion";

export default function PaginaConfiguracionAdmin() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-scouts-purple/65">
          Cargando configuración...
        </p>
      }
    >
      <ConfiguracionAdmin />
    </Suspense>
  );
}

async function ConfiguracionAdmin() {
  await requerirAdmin();
  const { configuracion, error } = await cargarConfiguracionChat();

  if (error || !configuracion) {
    return (
      <p
        className="rounded-2xl bg-scouts-red/8 p-4 text-scouts-red text-sm"
        role="alert"
      >
        No se pudo cargar la configuración. Intenta de nuevo; no se ha
        modificado ningún valor.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-2xl text-scouts-purple">
            Configuración operativa
          </h2>
          <p className="mt-2 max-w-2xl text-foreground/70 text-sm leading-6">
            Ajusta cómo responde Zulú y cuánto uso permite. Los cambios se
            aplican a las solicitudes nuevas sin volver a desplegar.
          </p>
        </div>
        <Settings2
          aria-hidden="true"
          className="hidden size-7 shrink-0 text-scouts-orange sm:block"
        />
      </header>

      <p className="rounded-2xl border border-scouts-blue/10 bg-scouts-blue/5 p-4 text-foreground/70 text-sm leading-6">
        Las claves de Gemini y Supabase siguen siendo secretos del servidor y no
        aparecen aquí. Cada guardado queda asociado a tu usuario en la auditoría
        administrativa.
      </p>

      <FormularioConfiguracion configuracion={configuracion} />
    </div>
  );
}
