import Link from "next/link";
import { cn } from "@/lib/utils";

const TAMANO_PAGINA = 50;

/** Lee `?pagina=` sin confiar en el valor: cualquier basura cae en la 1. */
export function leerPagina(valor: string | undefined) {
  return Math.max(1, Number.parseInt(valor ?? "1", 10) || 1);
}

/** Rango para `.range()` de PostgREST correspondiente a esa página. */
export function rangoDePagina(pagina: number) {
  const inicio = (pagina - 1) * TAMANO_PAGINA;
  return [inicio, inicio + TAMANO_PAGINA - 1] as const;
}

/**
 * Paginación de las tres listas del piloto: conversaciones del Scout,
 * conversaciones del panel y usuarios del panel. Las tres se paginan y no se
 * cortan con un `.limit()` a secas: PostgREST recorta en `db-max-rows` sin
 * devolver error, y una lista truncada sin navegación se lee como "no hay más".
 *
 * Si no viene `count` no se finge un total: se ofrece la página siguiente
 * mientras la actual venga llena, en vez de ocultar la navegación.
 *
 * `enlaceDeDocumento` fuerza `<a>` en vez de `next/link`: dentro de /admin
 * ninguna navegación puede ser SPA, porque esas páginas auditan al renderizar en
 * servidor y una ruta que queda en la caché de cliente del router se revelaría
 * con Atrás sin dejar fila en `admin_audit_events` (invariante de
 * app/admin/layout.tsx).
 */
export function Paginacion({
  pagina,
  total,
  cantidadEnPagina,
  href,
  etiquetas,
  etiquetaTotal,
  enlaceDeDocumento = false,
  className,
}: {
  pagina: number;
  total: number | null;
  cantidadEnPagina: number;
  href: (pagina: number) => string;
  etiquetas: { anterior: string; siguiente: string };
  etiquetaTotal?: string;
  enlaceDeDocumento?: boolean;
  className?: string;
}) {
  const totalPaginas =
    total == null ? null : Math.max(1, Math.ceil(total / TAMANO_PAGINA));
  const hayAnterior = pagina > 1;
  const haySiguiente =
    totalPaginas === null
      ? cantidadEnPagina === TAMANO_PAGINA
      : pagina < totalPaginas;

  if (!(hayAnterior || haySiguiente)) {
    return null;
  }

  return (
    <nav
      className={cn(
        "flex items-center justify-between pt-2 text-sm",
        className
      )}
    >
      {hayAnterior ? (
        <EnlacePagina
          deDocumento={enlaceDeDocumento}
          href={href(pagina - 1)}
          texto={etiquetas.anterior}
        />
      ) : (
        <span />
      )}
      <span className="text-foreground/70 text-xs">
        {totalPaginas === null
          ? `Página ${pagina}${etiquetaTotal ? " · total desconocido" : ""}`
          : `Página ${pagina} de ${totalPaginas}${etiquetaTotal ? ` · ${total} ${etiquetaTotal}` : ""}`}
      </span>
      {haySiguiente ? (
        <EnlacePagina
          deDocumento={enlaceDeDocumento}
          href={href(pagina + 1)}
          texto={etiquetas.siguiente}
        />
      ) : (
        <span />
      )}
    </nav>
  );
}

function EnlacePagina({
  deDocumento,
  href,
  texto,
}: {
  deDocumento: boolean;
  href: string;
  texto: string;
}) {
  if (deDocumento) {
    return (
      <a className="brand-page-link" href={href}>
        {texto}
      </a>
    );
  }
  return (
    <Link className="brand-page-link" href={href}>
      {texto}
    </Link>
  );
}
