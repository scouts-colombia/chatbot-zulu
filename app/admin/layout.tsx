import Link from "next/link";

export const metadata = { title: "Panel admin" };

export default function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4">
      <header className="flex flex-wrap items-center gap-4 border-b py-4">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/"
        >
          ← Chat
        </Link>
        <h1 className="font-semibold">Panel admin</h1>
        <nav className="flex gap-3 text-sm">
          <Link className="hover:underline" href="/admin/conversaciones">
            Conversaciones
          </Link>
          <Link className="hover:underline" href="/admin/documentos">
            Documentos
          </Link>
          <Link className="hover:underline" href="/admin/usuarios">
            Usuarios
          </Link>
        </nav>
      </header>
      <main className="flex-1 py-6">{children}</main>
    </div>
  );
}
