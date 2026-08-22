"use client";

import {
  Archive01Icon,
  BookOpen01Icon,
  Folder02Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  PencilEdit02Icon,
  PinIcon,
  Search01Icon,
  Share01Icon,
  SidebarLeftIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { archivarConversacion, crearConversacion } from "@/app/chat/acciones";
import { jollygood } from "@/app/fuentes";
import { NavUsuario } from "@/components/chat/nav-usuario";
import { Paginacion } from "@/components/navegacion/paginacion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ConversacionListado } from "./tipos";

const FUNCIONES_PROXIMAS = [
  { icono: Search01Icon, etiqueta: "Buscar" },
  { icono: BookOpen01Icon, etiqueta: "Biblioteca" },
  { icono: Folder02Icon, etiqueta: "Proyectos" },
] as const;

const ACCIONES_PROXIMAS = [
  { icono: PencilEdit01Icon, etiqueta: "Cambiar nombre" },
  { icono: PinIcon, etiqueta: "Fijar" },
  { icono: Share01Icon, etiqueta: "Compartir" },
] as const;

const claseAccionBarra =
  "flex h-9 w-full items-center justify-start gap-2 overflow-hidden whitespace-nowrap rounded-lg px-2 font-medium text-foreground/80 text-sm transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:bg-zulu-cafe/10 hover:text-foreground";

const CLAVE_BARRA_COLAPSADA = "zulu:barra-colapsada";

export function MarcoChat({
  children,
  titulo,
  archivada = false,
  conversaciones,
  totalConversaciones,
  errorConversaciones,
  pagina,
  conversacionActivaId = null,
  nombre,
  correo,
  esAdmin,
  avisoArchivar = false,
  borradorTransferenciaId = null,
}: {
  children: React.ReactNode;
  titulo: string;
  archivada?: boolean;
  conversaciones: ConversacionListado[];
  totalConversaciones: number | null;
  errorConversaciones: boolean;
  pagina: number;
  conversacionActivaId?: string | null;
  nombre: string;
  correo: string;
  esAdmin: boolean;
  avisoArchivar?: boolean;
  borradorTransferenciaId?: string | null;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [barraColapsada, setBarraColapsada] = useState(false);

  useEffect(() => {
    setBarraColapsada(localStorage.getItem(CLAVE_BARRA_COLAPSADA) === "1");
  }, []);

  const alternarBarra = () => {
    setBarraColapsada((colapsada) => {
      const siguiente = !colapsada;
      localStorage.setItem(CLAVE_BARRA_COLAPSADA, siguiente ? "1" : "0");
      return siguiente;
    });
  };

  // En `/chat/:id` Conversacion ya consumió el token; reenviarlo a "Nuevo
  // chat" deja el compositor vacío y el texto varado en el hilo anterior.
  const borradorParaNuevoChat = conversacionActivaId
    ? null
    : borradorTransferenciaId;

  const propsBarra = {
    borradorTransferenciaId: borradorParaNuevoChat,
    conversacionActivaId: conversacionActivaId ?? null,
    conversaciones,
    errorConversaciones,
    correo,
    esAdmin,
    nombre,
    pagina,
    totalConversaciones,
  };

  return (
    <div className="flex h-dvh">
      <a
        className="focus-ring absolute top-3 left-3 z-[100] -translate-y-[220%] rounded-lg bg-white px-3 py-2 text-scouts-purple focus:translate-y-0"
        href="#contenido-principal"
      >
        Saltar al contenido
      </a>
      <aside
        className={cn(
          "hidden h-dvh shrink-0 overflow-hidden p-3 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:flex sm:flex-col",
          // 90px: 24 (padding del aside) + 24 (padding de la tarjeta) + 2
          // (bordes) + 40 de contenido — el logo de 40px cabe justo y los
          // px-[11px]/px-1 de los ítems quedan centrados exactos.
          barraColapsada ? "w-[5.625rem]" : "w-72"
        )}
      >
        <ContenidoBarra
          colapsada={barraColapsada}
          onColapsar={alternarBarra}
          {...propsBarra}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-2 px-3 sm:min-h-16 sm:px-5">
          <Sheet onOpenChange={setMenuAbierto} open={menuAbierto}>
            <SheetTrigger asChild>
              <Button
                aria-label="Abrir conversaciones"
                className="text-scouts-purple sm:hidden"
                size="icon"
                type="button"
                variant="ghost"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-5"
                  icon={SidebarLeftIcon}
                  strokeWidth={1.8}
                />
              </Button>
            </SheetTrigger>
            <SheetContent
              className="w-72 border-white/40 bg-pnpj-crema/85 p-3 shadow-none backdrop-blur-md"
              showCloseButton={false}
              side="left"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Conversaciones</SheetTitle>
              </SheetHeader>
              <ContenidoBarra
                onNavigate={() => setMenuAbierto(false)}
                {...propsBarra}
              />
            </SheetContent>
          </Sheet>
          {barraColapsada ? (
            <Button
              aria-expanded={false}
              aria-label="Mostrar conversaciones"
              className="hidden text-foreground/45 hover:bg-zulu-cafe/10 hover:text-foreground sm:flex"
              onClick={alternarBarra}
              size="icon"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-5"
                icon={SidebarLeftIcon}
                strokeWidth={1.8}
              />
            </Button>
          ) : null}
          <h1 className="min-w-0 flex-1 truncate font-medium text-pnpj-morado text-sm">
            {titulo}
          </h1>
          {archivada ? (
            <span className="flex items-center gap-1 rounded-full bg-scouts-yellow px-2 py-1 font-medium text-scouts-purple text-xs">
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3"
                icon={Archive01Icon}
                strokeWidth={1.8}
              />
              <span className="sr-only">Conversación archivada</span>
              <span aria-hidden="true" className="hidden sm:inline">
                Archivada
              </span>
            </span>
          ) : null}
          <form action={crearConversacion} className="sm:hidden">
            {borradorParaNuevoChat ? (
              <input
                name="borrador"
                type="hidden"
                value={borradorParaNuevoChat}
              />
            ) : null}
            <Button
              aria-label="Nueva conversación"
              className="text-scouts-purple"
              size="icon"
              type="submit"
              variant="ghost"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-5"
                icon={PencilEdit02Icon}
                strokeWidth={1.8}
              />
            </Button>
          </form>
        </header>
        {avisoArchivar ? (
          <p className="brand-alert mx-3 mb-2 sm:mx-5" role="alert">
            No se pudo archivar la conversación. Intenta de nuevo.
          </p>
        ) : null}
        <main className="flex min-h-0 flex-1 flex-col" id="contenido-principal">
          {children}
        </main>
      </div>
    </div>
  );
}

function ContenidoBarra({
  conversaciones,
  totalConversaciones,
  errorConversaciones,
  pagina,
  conversacionActivaId,
  nombre,
  correo,
  esAdmin,
  borradorTransferenciaId,
  onNavigate,
  colapsada = false,
  onColapsar,
}: {
  conversaciones: ConversacionListado[];
  totalConversaciones: number | null;
  errorConversaciones: boolean;
  pagina: number;
  conversacionActivaId: string | null;
  nombre: string;
  correo: string;
  esAdmin: boolean;
  borradorTransferenciaId: string | null;
  onNavigate?: () => void;
  colapsada?: boolean;
  onColapsar?: () => void;
}) {
  const hrefPagina = (destino: number) => {
    const base = conversacionActivaId ? `/chat/${conversacionActivaId}` : "/";
    return `${base}?pagina=${destino}`;
  };
  const volver = conversacionActivaId ? `/chat/${conversacionActivaId}` : "/";
  const claseEtiqueta = cn(
    "min-w-0 overflow-hidden truncate transition-opacity duration-300 ease-out motion-reduce:transition-none",
    colapsada ? "w-0 opacity-0" : "opacity-100"
  );

  return (
    <div className="auth-card-surface flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-3">
      <div
        className={cn("mb-3 flex min-h-10 items-center", !colapsada && "gap-1")}
      >
        <Link
          aria-label={colapsada ? "Mostrar conversaciones" : undefined}
          className={cn(
            "focus-ring flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg py-1 text-scouts-purple transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            colapsada ? "px-0" : "px-2"
          )}
          href="/"
          onClick={(evento) => {
            if (colapsada) {
              evento.preventDefault();
              onColapsar?.();
              return;
            }
            onNavigate?.();
          }}
        >
          <Image
            alt=""
            className="size-10 shrink-0"
            height={40}
            priority
            src="/images/zulu/zulu-icono.svg"
            unoptimized
            width={40}
          />
          <span className={cn("grid min-w-0 leading-none", claseEtiqueta)}>
            <span
              className={cn(
                jollygood.className,
                "text-2xl font-bold tracking-tight"
              )}
            >
              Zulú
            </span>
            <span className="-mt-0.5 truncate font-medium text-[0.625rem] text-scouts-purple/55">
              Scouts de Colombia
            </span>
          </span>
        </Link>
        {onColapsar ? (
          <Button
            aria-expanded={!colapsada}
            aria-hidden={colapsada || undefined}
            aria-label="Ocultar conversaciones"
            className={cn(
              "shrink-0 text-foreground/45 hover:bg-zulu-cafe/10 hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-foreground/45 hover:aria-expanded:bg-zulu-cafe/10 hover:aria-expanded:text-foreground",
              colapsada &&
                "pointer-events-none w-0 min-w-0 overflow-hidden border-0 p-0 opacity-0"
            )}
            onClick={onColapsar}
            size="icon"
            tabIndex={colapsada ? -1 : undefined}
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-5"
              icon={SidebarLeftIcon}
              strokeWidth={1.8}
            />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-0">
        <form action={crearConversacion}>
          {borradorTransferenciaId ? (
            <input
              name="borrador"
              type="hidden"
              value={borradorTransferenciaId}
            />
          ) : null}
          <Button
            aria-label="Nuevo chat"
            className={cn(claseAccionBarra, colapsada && "px-[11px]")}
            type="submit"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-[18px] shrink-0"
              icon={PencilEdit02Icon}
              strokeWidth={1.8}
            />
            <span className={claseEtiqueta}>Nuevo chat</span>
          </Button>
        </form>
        {FUNCIONES_PROXIMAS.map((funcion) => (
          <button
            className={cn(
              claseAccionBarra,
              "cursor-not-allowed opacity-55 hover:bg-transparent hover:text-foreground/80",
              colapsada && "px-[11px]"
            )}
            disabled
            key={funcion.etiqueta}
            type="button"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-[18px] shrink-0"
              icon={funcion.icono}
              strokeWidth={1.8}
            />
            <span className={cn(claseEtiqueta, "text-left")}>
              {funcion.etiqueta}
            </span>
            <span
              className={cn(
                "shrink-0 text-foreground/50 text-xs",
                claseEtiqueta
              )}
            >
              Próximamente
            </span>
          </button>
        ))}
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden transition-opacity duration-300 ease-out motion-reduce:transition-none",
          colapsada && "pointer-events-none opacity-0"
        )}
        inert={colapsada || undefined}
      >
        <p className="mt-5 mb-1 px-2 font-medium text-muted-foreground text-xs">
          Conversaciones
        </p>
        <nav
          aria-label="Conversaciones"
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <ListadoConversaciones
            conversacionActivaId={conversacionActivaId}
            conversaciones={conversaciones}
            errorConversaciones={errorConversaciones}
            onNavigate={onNavigate}
            volver={volver}
          />
        </nav>
        <Paginacion
          cantidadEnPagina={conversaciones.length}
          className="px-1"
          etiquetas={{
            anterior: "← Anteriores",
            siguiente: "Más antiguas →",
          }}
          href={hrefPagina}
          pagina={pagina}
          total={totalConversaciones}
        />
      </div>
      <div className="mt-2">
        <NavUsuario
          compacto={colapsada}
          correo={correo}
          esAdmin={esAdmin}
          nombre={nombre}
        />
      </div>
    </div>
  );
}

function TituloConversacion({ titulo }: { titulo: string }) {
  const caja = useRef<HTMLSpanElement>(null);
  const linea = useRef<HTMLSpanElement>(null);
  const excesoRef = useRef(0);
  const [exceso, setExceso] = useState(0);
  const [deslizando, setDeslizando] = useState(false);
  const [enFinal, setEnFinal] = useState(false);
  excesoRef.current = exceso;

  useEffect(() => {
    const medir = () => {
      const marco = caja.current;
      const texto = linea.current;
      if (!(marco && texto)) {
        return;
      }
      setExceso(Math.max(0, texto.scrollWidth - marco.clientWidth));
    };
    medir();
    const observador = new ResizeObserver(medir);
    if (caja.current) {
      observador.observe(caja.current);
    }
    const fila = caja.current?.closest("[data-fila-chat]");
    const entrar = () => {
      if (excesoRef.current > 0) {
        setDeslizando(true);
        setEnFinal(false);
      }
    };
    const resetear = () => {
      setDeslizando(false);
      setEnFinal(false);
    };
    fila?.addEventListener("mouseenter", entrar);
    fila?.addEventListener("mouseleave", resetear);
    return () => {
      observador.disconnect();
      fila?.removeEventListener("mouseenter", entrar);
      fila?.removeEventListener("mouseleave", resetear);
    };
  }, []);

  let mascara = "";
  if (exceso > 0) {
    if (deslizando) {
      mascara =
        "[mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-1.25rem),transparent)]";
    } else if (enFinal) {
      mascara =
        "[mask-image:linear-gradient(to_right,transparent,black_0.75rem,black)]";
    } else {
      mascara =
        "[mask-image:linear-gradient(to_right,black_calc(100%-1.25rem),transparent)]";
    }
  }

  return (
    <span
      className={cn(
        "min-w-0 flex-1 overflow-hidden [mask-repeat:no-repeat]",
        mascara
      )}
      ref={caja}
    >
      <span
        className="inline-block whitespace-nowrap transition-transform duration-0 ease-linear motion-reduce:transition-none group-hover/chat:translate-x-[calc(var(--exceso)*-1)] group-hover/chat:[transition-duration:var(--duracion)] group-focus-within/chat:translate-x-[calc(var(--exceso)*-1)] group-focus-within/chat:[transition-duration:var(--duracion)]"
        onTransitionEnd={(evento) => {
          if (evento.propertyName !== "transform") {
            return;
          }
          const fila = evento.currentTarget.closest("[data-fila-chat]");
          if (!fila?.matches(":hover, :focus-within")) {
            setDeslizando(false);
            setEnFinal(false);
            return;
          }
          setDeslizando(false);
          setEnFinal(excesoRef.current > 0);
        }}
        ref={linea}
        style={{
          ["--duracion" as string]: `${Math.max(1.5, exceso / 35)}s`,
          ["--exceso" as string]: `${exceso}px`,
        }}
      >
        {titulo}
      </span>
    </span>
  );
}

function ListadoConversaciones({
  conversaciones,
  conversacionActivaId,
  errorConversaciones,
  onNavigate,
  volver,
}: {
  conversaciones: ConversacionListado[];
  conversacionActivaId: string | null;
  errorConversaciones: boolean;
  onNavigate?: () => void;
  volver: string;
}) {
  if (errorConversaciones) {
    return (
      <p className="px-3 py-4 text-scouts-red text-sm" role="alert">
        No pudimos cargar tus conversaciones. Recarga la página; si el problema
        sigue, vuelve en un momento.
      </p>
    );
  }
  if (conversaciones.length === 0) {
    return (
      <p className="px-3 py-4 text-foreground/70 text-sm">
        Aún no tienes conversaciones.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {conversaciones.map((conversacion) => {
        const activa = conversacion.id === conversacionActivaId;
        return (
          <li
            className="group/chat relative"
            data-fila-chat=""
            key={conversacion.id}
          >
            <Link
              aria-current={activa ? "page" : undefined}
              className={cn(
                "focus-ring flex h-9 items-center overflow-hidden rounded-lg px-2 text-sm font-medium transition-[padding,color,background-color] duration-200",
                "group-hover/chat:pr-9 group-focus-within/chat:pr-9 group-has-[[data-popup-open]]/chat:pr-9 max-sm:pr-9",
                activa
                  ? "bg-scouts-purple text-white shadow-sm"
                  : "text-foreground/80 hover:bg-zulu-cafe/10 hover:text-foreground"
              )}
              href={`/chat/${conversacion.id}`}
              onClick={onNavigate}
            >
              <TituloConversacion
                key={conversacion.title}
                titulo={conversacion.title}
              />
            </Link>
            <div className="absolute inset-y-0 right-1 flex items-center opacity-0 transition-opacity duration-200 group-focus-within/chat:opacity-100 group-hover/chat:opacity-100 group-has-[[data-popup-open]]/chat:opacity-100 max-sm:opacity-100">
              <MenuConversacion
                activa={activa}
                id={conversacion.id}
                titulo={conversacion.title}
                volver={volver}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MenuConversacion({
  id,
  titulo,
  volver,
  activa,
}: {
  id: string;
  titulo: string;
  volver: string;
  activa: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Más acciones para ${titulo}`}
            className={cn(
              "size-7 min-h-7 min-w-7",
              activa
                ? "text-white hover:bg-white/20 hover:text-white"
                : "text-foreground/60 hover:bg-zulu-cafe/10 hover:text-foreground"
            )}
            size="icon"
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeiconsIcon
          aria-hidden="true"
          className="size-[18px]"
          icon={MoreHorizontalIcon}
          strokeWidth={1.8}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48" side="right">
        {ACCIONES_PROXIMAS.map((accion) => (
          <DropdownMenuItem className="min-h-9" disabled key={accion.etiqueta}>
            <HugeiconsIcon
              aria-hidden="true"
              className="size-[18px]"
              icon={accion.icono}
              strokeWidth={1.8}
            />
            <span className="flex-1">{accion.etiqueta}</span>
            <span className="text-[0.65rem] text-muted-foreground">
              Próximamente
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <form action={archivarConversacion} className="w-full">
          <input name="id" type="hidden" value={id} />
          <input name="volver" type="hidden" value={volver} />
          <DropdownMenuItem
            className="min-h-9 w-full"
            nativeButton
            render={<button className="w-full" type="submit" />}
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-[18px]"
              icon={Archive01Icon}
              strokeWidth={1.8}
            />
            Archivar
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
