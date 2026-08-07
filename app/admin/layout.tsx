import { FileText, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import { FondoMarca } from "@/components/marca/fondo-marca";
import { ReauditarNavegacion } from "./reauditar-navegacion";

export const metadata = { title: "Panel admin" };

/**
 * Invariante del panel: ningún `next/link` dentro de /admin, ni para entrar ni
 * para salir. Las páginas admin auditan al renderizar en servidor, y una
 * navegación SPA deja la ruta montada en la caché de cliente del App Router
 * (con `cacheComponents` hasta 3 árboles en un `<Activity>` oculto): volver con
 * Atrás la revelaría sin re-ejecutar el server component, es decir sin fila
 * nueva en `admin_audit_events` y sin volver a pasar por `requerirAdmin`.
 * Con `<a>` cada visualización es una navegación de documento y sí queda
 * auditada. Por eso tampoco hacen falta los `prefetch={false}`.
 */

export default function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FondoMarca>
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
        {/* Re-audita las reaperturas restauradas desde la caché del cliente
          (atrás/adelante, bfcache): fuerza un render de servidor en cada una. */}
        <ReauditarNavegacion />
        <header className="app-shell-header mt-3 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 sm:mt-5 sm:px-5">
          <a
            className="focus-ring rounded-lg px-2 py-2 text-sm text-scouts-purple/75 hover:text-scouts-purple"
            href="/"
          >
            ← Chat
          </a>
          <h1 className="mr-auto flex items-center gap-2 font-semibold text-scouts-purple">
            <ShieldCheck
              aria-hidden="true"
              className="size-5 text-scouts-orange"
            />
            Panel admin
          </h1>
          <nav
            aria-label="Secciones administrativas"
            className="grid w-full grid-cols-3 gap-2 text-sm sm:flex sm:w-auto"
          >
            <a className="admin-nav-link" href="/admin/conversaciones">
              <MessagesSquare aria-hidden="true" className="size-4" />
              Conversaciones
            </a>
            <a className="admin-nav-link" href="/admin/documentos">
              <FileText aria-hidden="true" className="size-4" />
              Documentos
            </a>
            <a className="admin-nav-link" href="/admin/usuarios">
              <Users aria-hidden="true" className="size-4" />
              Usuarios
            </a>
          </nav>
        </header>
        <main className="flex-1 py-5 sm:py-8">
          <div className="auth-card-surface min-h-full rounded-3xl p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </FondoMarca>
  );
}
