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
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4">
      {/* Re-audita las reaperturas restauradas desde la caché del cliente
          (atrás/adelante, bfcache): fuerza un render de servidor en cada una. */}
      <ReauditarNavegacion />
      <header className="flex flex-wrap items-center gap-4 border-b py-4">
        <a
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/"
        >
          ← Chat
        </a>
        <h1 className="font-semibold">Panel admin</h1>
        <nav className="flex gap-3 text-sm">
          <a className="hover:underline" href="/admin/conversaciones">
            Conversaciones
          </a>
          <a className="hover:underline" href="/admin/documentos">
            Documentos
          </a>
          <a className="hover:underline" href="/admin/usuarios">
            Usuarios
          </a>
        </nav>
      </header>
      <main className="flex-1 py-6">{children}</main>
    </div>
  );
}
