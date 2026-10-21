import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Conexión con Supabase. Se activa poniendo VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
 * (en .env.local o en las variables del proyecto en Vercel). Sin ellas la app funciona como siempre,
 * con los datos en el navegador.
 *
 * La llave "anon" es pública por diseño: lo que protege los datos son las políticas RLS
 * de supabase/migrations, que solo dejan a cada persona ver lo suyo.
 */
const config = () => ({
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
});

/** El archivo portátil (doble clic, file://) nunca usa la nube. */
export function nubeDisponible(): boolean {
  const { url, key } = config();
  return !!url && !!key && typeof window !== "undefined" && window.location.protocol !== "file:";
}

let cliente: Promise<SupabaseClient> | null = null;

/** El cliente se descarga solo cuando hace falta, para que el modo sin cuenta siga siendo liviano. */
export function nube(): Promise<SupabaseClient> {
  if (!nubeDisponible()) return Promise.reject(new Error("La nube no está configurada."));
  const { url, key } = config();
  cliente ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, key!, {
      auth: {
        // PKCE: el enlace del correo vuelve con ?code=..., que no choca con las rutas de la app (#/...).
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "cuadre:sesion",
      },
    }),
  );
  return cliente;
}

/** Solo para pruebas: usar un cliente falso. */
export function usarClientePrueba(c: SupabaseClient | null) {
  cliente = c ? Promise.resolve(c) : null;
}
