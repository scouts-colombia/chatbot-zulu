"use client";

import {
  ArrowUpDownIcon,
  CheckmarkBadge01Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cerrarSesion } from "@/app/(auth)/acciones";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function iniciales(nombre: string, correo: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) {
    const primera = partes.at(0)?.at(0) ?? "";
    const ultima = partes.at(-1)?.at(0) ?? "";
    return `${primera}${ultima}`.toUpperCase();
  }
  const unica = partes.at(0);
  if (unica && unica.length >= 2) {
    return unica.slice(0, 2).toUpperCase();
  }
  return correo.slice(0, 2).toUpperCase();
}

export function NavUsuario({
  nombre,
  correo,
  esAdmin,
  compacto = false,
}: {
  nombre: string;
  correo: string;
  esAdmin: boolean;
  compacto?: boolean;
}) {
  const etiqueta = nombre.trim() || correo;
  const mostrarCorreo = Boolean(correo) && correo !== etiqueta;
  const letras = iniciales(etiqueta, correo);

  const ficha = (
    <>
      <Avatar className="size-8 shrink-0 rounded-lg">
        <AvatarFallback className="rounded-lg">{letras}</AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "grid min-w-0 text-left text-sm leading-tight transition-opacity duration-300 ease-out motion-reduce:transition-none",
          compacto ? "w-0 overflow-hidden opacity-0" : "flex-1"
        )}
      >
        <span className="truncate font-medium">{etiqueta}</span>
        {mostrarCorreo ? (
          <span className="truncate text-foreground/60 text-xs">{correo}</span>
        ) : null}
      </div>
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 text-foreground/50 transition-opacity duration-300 ease-out motion-reduce:transition-none",
          compacto ? "w-0 overflow-hidden opacity-0" : "ml-auto"
        )}
        icon={ArrowUpDownIcon}
        strokeWidth={1.8}
      />
    </>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={compacto ? etiqueta : undefined}
            className={cn(
              "h-auto min-h-9 w-full justify-start gap-2 overflow-hidden py-1.5 text-foreground transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:bg-zulu-cafe/10 hover:text-foreground",
              compacto ? "px-1" : "px-2"
            )}
            type="button"
            variant="ghost"
          />
        }
      >
        {ficha}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56"
        side="right"
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-0 font-normal text-foreground">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{letras}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate font-medium">{etiqueta}</span>
              {mostrarCorreo ? (
                <span className="truncate text-foreground/60 text-xs">
                  {correo}
                </span>
              ) : null}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {esAdmin ? (
          <>
            <DropdownMenuItem nativeButton={false} render={<a href="/admin" />}>
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4"
                icon={CheckmarkBadge01Icon}
                strokeWidth={1.8}
              />
              Panel admin
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <form action={cerrarSesion} className="w-full">
          <DropdownMenuItem
            className="w-full"
            nativeButton
            render={<button className="w-full" type="submit" />}
            variant="destructive"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-4"
              icon={Logout01Icon}
              strokeWidth={1.8}
            />
            Cerrar sesión
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
