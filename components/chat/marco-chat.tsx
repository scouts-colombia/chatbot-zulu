"use client";

import {
  Archive01Icon,
  CheckmarkBadge01Icon,
  Logout01Icon,
  PlusSignIcon,
  SidebarLeftIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cerrarSesion } from "@/app/(auth)/acciones";
import { archivarConversacion, crearConversacion } from "@/app/chat/acciones";
import { Paginacion } from "@/components/navegacion/paginacion";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { glassCard } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { ConversacionListado } from "./tipos";

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
  esAdmin: boolean;
  avisoArchivar?: boolean;
  borradorTransferenciaId?: string | null;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const propsBarra = {
    borradorTransferenciaId,
    conversacionActivaId: conversacionActivaId ?? null,
    conversaciones,
    errorConversaciones,
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
      <aside className="hidden h-dvh w-64 shrink-0 p-3 sm:flex sm:flex-col">
        <ContenidoBarra {...propsBarra} />
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
              className="w-[18.5rem] border-white/40 bg-pnpj-crema/85 p-3 shadow-none backdrop-blur-md"
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
            {borradorTransferenciaId ? (
              <input
                name="borrador"
                type="hidden"
                value={borradorTransferenciaId}
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
                icon={PlusSignIcon}
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
  esAdmin,
  borradorTransferenciaId,
  onNavigate,
}: {
  conversaciones: ConversacionListado[];
  totalConversaciones: number | null;
  errorConversaciones: boolean;
  pagina: number;
  conversacionActivaId: string | null;
  nombre: string;
  esAdmin: boolean;
  borradorTransferenciaId: string | null;
  onNavigate?: () => void;
}) {
  const hrefPagina = (destino: number) => {
    const base = conversacionActivaId ? `/chat/${conversacionActivaId}` : "/";
    return `${base}?pagina=${destino}`;
  };
  const volver = conversacionActivaId ? `/chat/${conversacionActivaId}` : "/";

  return (
    <div
      className={cn(glassCard, "flex h-full min-h-0 flex-col rounded-2xl p-3")}
    >
      <Link
        className="focus-ring mb-3 flex items-center gap-2 rounded-lg px-1 py-1 text-scouts-purple"
        href="/"
        onClick={onNavigate}
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
        <span className="font-semibold tracking-[-0.02em]">Zulú</span>
      </Link>
      <form action={crearConversacion} className="mb-3">
        {borradorTransferenciaId ? (
          <input
            name="borrador"
            type="hidden"
            value={borradorTransferenciaId}
          />
        ) : null}
        <Button
          className="btn-press min-h-11 w-full bg-scouts-yellow text-scouts-purple hover:bg-scouts-yellow/90"
          type="submit"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={PlusSignIcon}
            strokeWidth={1.8}
          />
          Nueva conversación
        </Button>
      </form>
      <p className="mb-1 px-3 text-sm font-semibold tracking-widest text-muted-foreground uppercase">
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
      <div className="mt-2 border-black/5 border-t pt-2">
        <p className="truncate px-3 py-1.5 text-foreground/80 text-sm">
          {nombre}
          {esAdmin ? " · admin" : ""}
        </p>
        {esAdmin ? (
          <a
            aria-label="Panel de administración"
            className="focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-foreground/70 text-sm font-medium hover:bg-white/60 hover:text-foreground"
            href="/admin"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-4 shrink-0"
              icon={CheckmarkBadge01Icon}
              strokeWidth={1.8}
            />
            Panel admin
          </a>
        ) : null}
        <form action={cerrarSesion}>
          <Button
            className="min-h-11 w-full justify-start gap-3 px-3 text-foreground/70 hover:bg-white/60 hover:text-foreground"
            type="submit"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-4"
              icon={Logout01Icon}
              strokeWidth={1.8}
            />
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
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
    <ul className="flex flex-col gap-1">
      {conversaciones.map((conversacion) => {
        const activa = conversacion.id === conversacionActivaId;
        return (
          <li className="flex items-center gap-0.5" key={conversacion.id}>
            <Link
              aria-current={activa ? "page" : undefined}
              className={cn(
                "focus-ring min-w-0 flex-1 truncate rounded-lg px-3 py-2.5 text-base font-medium transition-colors",
                activa
                  ? "bg-scouts-purple text-white shadow-sm"
                  : "text-foreground/70 hover:bg-white/60 hover:text-foreground"
              )}
              href={`/chat/${conversacion.id}`}
              onClick={onNavigate}
            >
              {conversacion.title}
            </Link>
            <form action={archivarConversacion}>
              <input name="id" type="hidden" value={conversacion.id} />
              <input name="volver" type="hidden" value={volver} />
              <Button
                aria-label={`Archivar ${conversacion.title}`}
                className={cn(
                  "min-h-11 min-w-11 shrink-0",
                  activa
                    ? "text-scouts-purple hover:bg-white/70"
                    : "text-foreground/45 hover:bg-white/60 hover:text-foreground"
                )}
                size="icon"
                type="submit"
                variant="ghost"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={Archive01Icon}
                  strokeWidth={1.8}
                />
              </Button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
