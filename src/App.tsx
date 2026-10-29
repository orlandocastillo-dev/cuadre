import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RouterProvider, type createHashRouter } from "react-router";
import { useAppDispatch } from "./app/hooks";
import { abrirEnlaceDelCorreo, escucharSesion, salir, usuarioDe, type Usuario } from "./auth/cuenta";
import { CuentaContext, type CuentaCtx } from "./auth/CuentaContext";
import { ledgerApi, setRepository } from "./data/ledgerApi";
import { LocalRepository } from "./data/local";
import { nube, nubeDisponible } from "./data/nube";
import { SupabaseRepository } from "./data/supabase";
import type { Ledger } from "./domain/types";
import { Acceso, type VistaAcceso } from "./pages/Acceso";
import { Bienvenida } from "./pages/Bienvenida";
import { PasarDatos } from "./pages/PasarDatos";

type Router = ReturnType<typeof createHashRouter>;

type Pantalla =
  | { tipo: "cargando" }
  | { tipo: "acceso"; vista: VistaAcceso; aviso?: string | null }
  | { tipo: "nueva-clave" }
  | { tipo: "bienvenida" }
  | { tipo: "pasar"; local: Ledger }
  | { tipo: "app" };

/** El usuario eligió usar la app sin cuenta en este dispositivo. */
const MODO = "cuadre:modo";
/** Cuentas a las que ya se les ofreció pasar los datos locales. */
const OFRECIDO = "cuadre:pasar-ofrecido";

const leer = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const guardar = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // Navegador en modo privado: se recuerda solo mientras la pestaña esté abierta.
  }
};

// Decide qué se muestra al abrir la app
export function App({ router, local }: { router: Router; local: LocalRepository }) {
  const dispatch = useAppDispatch();
  const disponible = nubeDisponible();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [modo, setModo] = useState<"local" | "nube">("local");
  const [pantalla, setPantalla] = useState<Pantalla>(() => {
    if (!disponible) return local.hasData() ? { tipo: "app" } : { tipo: "bienvenida" };
    // "Ver con datos de ejemplo" desde la presentación: directo, sin cuenta.
    if (window.location.hash === "#ejemplo") return { tipo: "bienvenida" };
    return { tipo: "cargando" };
  });
  const usuarioActual = useRef<string | null>(null);
  // Lo que pidió la presentación (#ejemplo, #crear). Se lee una vez al abrir: la bienvenida limpia la dirección antes de que corra el efecto de aquí.
  const pedido = useRef(window.location.hash);

  const usarLocal = useCallback(() => {
    setRepository(local);
    dispatch(ledgerApi.util.resetApiState());
    setModo("local");
    usuarioActual.current = null;
  }, [dispatch, local]);

  const sinCuenta = useCallback(() => {
    guardar(MODO, "local");
    usarLocal();
    setPantalla(local.hasData() ? { tipo: "app" } : { tipo: "bienvenida" });
  }, [local, usarLocal]);

  // Con sesión: los datos pasan a ser los de la cuenta.
  const conSesion = useCallback(
    async (u: Usuario) => {
      if (usuarioActual.current === u.id) return;
      usuarioActual.current = u.id;
      const repo = new SupabaseRepository(await nube(), u.id);
      setRepository(repo);
      dispatch(ledgerApi.util.resetApiState());
      setUsuario(u);
      setModo("nube");
      guardar(MODO, null);

      const ofrecidos = (leer(OFRECIDO) ?? "").split(",");
      if (local.hasData() && !ofrecidos.includes(u.id)) {
        const datos = await local.load();
        const vacia = datos.transactions.length > 0 && (await repo.estaVacia().catch(() => false));
        if (vacia) return setPantalla({ tipo: "pasar", local: datos });
      }
      setPantalla({ tipo: "app" });
    },
    [dispatch, local],
  );

  useEffect(() => {
    if (!disponible) {
      setRepository(local);
      return;
    }
    if (pedido.current === "#ejemplo") guardar(MODO, "local");
    // "Empezar gratis" es para crear la cuenta propia, aunque antes se haya mirado el ejemplo en este celular.
    if (pedido.current === "#crear") guardar(MODO, null);
    // Si se llega desde el correo, manda el correo: no se abre el modo sin cuenta que haya quedado guardado.
    const desdeCorreo = /[?&](code|token_hash|error_description)=/.test(window.location.search);
    if (desdeCorreo) guardar(MODO, null);
    // "Empezar gratis" en la presentación abre directo en "Crear cuenta".
    const vistaInicial: VistaAcceso = pedido.current === "#crear" ? "crear" : "entrar";
    if (vistaInicial === "crear") window.history.replaceState(null, "", window.location.pathname + window.location.search);
    let avisoEnlace: string | null = null;
    let quitar: (() => void) | undefined;
    let vivo = true;
    escucharSesion((evento, sesion) => {
      // Supabase pide no esperar otras llamadas dentro de este aviso: se hace en el siguiente ciclo.
      setTimeout(() => {
        if (!vivo) return;
        const u = usuarioDe(sesion);
        if (evento === "PASSWORD_RECOVERY") {
          if (u) void conSesion(u).then(() => setPantalla({ tipo: "nueva-clave" }));
          return;
        }
        if (u) {
          if (evento === "USER_UPDATED") setUsuario(u);
          else void conSesion(u);
          return;
        }
        // Sin sesión.
        usarLocal();
        setUsuario(null);
        if (leer(MODO) === "local") setPantalla(local.hasData() ? { tipo: "app" } : { tipo: "bienvenida" });
        else setPantalla({ tipo: "acceso", vista: vistaInicial, aviso: avisoEnlace ?? avisoDelEnlace() ?? (desdeCorreo ? "Tu correo quedó confirmado. Entra con tu correo y contraseña." : null) });
      }, 0);
    })
      .then((q) => {
        quitar = q;
        // El botón del correo, abierto en este u otro dispositivo: confirma la cuenta o abre el cambio de contraseña.
        return abrirEnlaceDelCorreo().then((res) => {
          if (res && !res.r.ok && vivo) {
            avisoEnlace = res.r.mensaje.startsWith("El código")
              ? "El enlace del correo venció o ya se usó. Entra con tu contraseña o pide uno nuevo."
              : res.r.mensaje;
            setPantalla({ tipo: "acceso", vista: "entrar", aviso: avisoEnlace });
          }
        });
      })
      .catch(() => {
        // No se pudo cargar el cliente (sin internet la primera vez): se sigue sin cuenta.
        usarLocal();
        setPantalla(local.hasData() ? { tipo: "app" } : { tipo: "bienvenida" });
      });
    return () => {
      vivo = false;
      quitar?.();
    };
  }, [disponible, conSesion, usarLocal, local]);

  const ctx = useMemo<CuentaCtx>(
    () => ({
      modo,
      usuario,
      nubeDisponible: disponible,
      irAAcceso: (vista = "crear") => {
        guardar(MODO, null);
        setPantalla({ tipo: "acceso", vista });
      },
      cerrarSesion: async () => {
        await salir();
        // onAuthStateChange (SIGNED_OUT) se encarga de volver a la pantalla de entrar.
      },
      actualizarUsuario: setUsuario,
    }),
    [modo, usuario, disponible],
  );

  let contenido;
  switch (pantalla.tipo) {
    case "cargando":
      contenido = (
        <main className="welcome" aria-busy="true">
          <p className="brand brand--big cargando">
            <span className="brand__mark" aria-hidden="true" />
            qadre
          </p>
        </main>
      );
      break;
    case "acceso":
      contenido = <Acceso key={pantalla.vista} vista={pantalla.vista} aviso={pantalla.aviso} onSinCuenta={sinCuenta} />;
      break;
    case "nueva-clave":
      contenido = <Acceso vista="nueva-clave" onClaveCambiada={() => setPantalla({ tipo: "app" })} />;
      break;
    case "bienvenida":
      contenido = <Bienvenida onDone={() => setPantalla({ tipo: "app" })} onCuenta={disponible ? () => ctx.irAAcceso("crear") : undefined} />;
      break;
    case "pasar":
      contenido = (
        <PasarDatos
          local={pantalla.local}
          nombre={usuario?.nombre ?? ""}
          onPasar={async () => {
            try {
              await new SupabaseRepository(await nube(), usuario!.id).replaceAll(pantalla.local);
              dispatch(ledgerApi.util.resetApiState());
              marcarOfrecido(usuario!.id);
              setPantalla({ tipo: "app" });
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : "No se pudieron pasar los datos.";
            }
          }}
          onOmitir={() => {
            marcarOfrecido(usuario!.id);
            setPantalla({ tipo: "app" });
          }}
        />
      );
      break;
    default:
      contenido = <RouterProvider router={router} />;
  }

  return <CuentaContext.Provider value={ctx}>{contenido}</CuentaContext.Provider>;
}

function marcarOfrecido(id: string) {
  const lista = (leer(OFRECIDO) ?? "").split(",").filter(Boolean);
  guardar(OFRECIDO, [...new Set([...lista, id])].join(","));
}

/** Si el enlace del correo venció o ya se usó, Supabase vuelve con ?error_description=... */
function avisoDelEnlace(): string | null {
  const q = new URLSearchParams(window.location.search);
  const desc = q.get("error_description") ?? q.get("error");
  if (!desc) return null;
  window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  return /expired|invalid/i.test(desc) ? "El enlace del correo venció o ya se usó. Pide uno nuevo." : "No se pudo abrir el enlace del correo. Inténtalo de nuevo.";
}
