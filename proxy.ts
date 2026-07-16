import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const RUTAS_PUBLICAS = ["/login", "/registro"];

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas:
 * sin sesión solo se puede estar en /login o /registro.
 *
 * Cuando hay refresh de tokens, @supabase/ssr entrega también headers
 * anti-caché (setAll(cookiesToSet, headers)): deben copiarse a la respuesta
 * para que un CDN nunca cachee un Set-Cookie de sesión. Y toda redirección
 * debe conservar las cookies refrescadas o el navegador sigue con tokens
 * viejos.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let authHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          authHeaders = headers ?? {};
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [clave, valor] of Object.entries(authHeaders)) {
            response.headers.set(clave, valor);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirigirA = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redireccion = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redireccion.cookies.set(cookie);
    }
    for (const [clave, valor] of Object.entries(authHeaders)) {
      redireccion.headers.set(clave, valor);
    }
    return redireccion;
  };

  const { pathname } = request.nextUrl;
  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) =>
    pathname.startsWith(ruta)
  );

  if (!(user || esRutaPublica)) {
    return redirigirA("/login");
  }

  if (user && esRutaPublica) {
    return redirigirA("/");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
