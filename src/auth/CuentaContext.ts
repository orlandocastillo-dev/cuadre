import { createContext, useContext } from "react";
import type { Usuario } from "./cuenta";

export interface CuentaCtx {
  // "nube": con sesión y datos en Supabase
  modo: "local" | "nube";
  usuario: Usuario | null;
  /** true si la app tiene Supabase configurado (se puede crear cuenta). */
  nubeDisponible: boolean;
  /** Ir a la pantalla de entrar o crear cuenta (desde el modo sin cuenta). */
  irAAcceso: (vista?: "entrar" | "crear") => void;
  cerrarSesion: () => Promise<void>;
  actualizarUsuario: (u: Usuario) => void;
}

export const CuentaContext = createContext<CuentaCtx>({
  modo: "local",
  usuario: null,
  nubeDisponible: false,
  irAAcceso: () => undefined,
  cerrarSesion: async () => undefined,
  actualizarUsuario: () => undefined,
});

export const useCuenta = () => useContext(CuentaContext);
