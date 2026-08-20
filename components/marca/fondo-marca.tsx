import { cn } from "@/lib/utils";

export function FondoMarca({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="pnpj-fondo relative min-h-dvh overflow-hidden text-pnpj-tinta">
      <div className={cn("relative z-10 min-h-dvh w-full", className)}>
        {children}
      </div>
    </div>
  );
}
