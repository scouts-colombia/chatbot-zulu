import { cn } from "@/lib/utils";

export function FondoMarca({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pnpj-fondo relative min-h-dvh overflow-hidden text-pnpj-tinta",
        className
      )}
      data-design-direction="ruta-editorial-glass"
    >
      <div className="relative z-10 min-h-dvh">{children}</div>
    </div>
  );
}
