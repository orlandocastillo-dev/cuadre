/**
 * Un Supabase falso, en memoria, con lo justo que usa la app: auth (crear cuenta, entrar, salir,
 * recuperar), tablas con select/upsert/delete filtrados por usuario y las dos funciones RPC.
 * Imita la regla RLS: cada consulta solo ve las filas del usuario con sesión.
 */
type Fila = Record<string, unknown>;
type Evento = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | "PASSWORD_RECOVERY";

interface UsuarioFalso {
  id: string;
  email: string;
  clave: string;
  confirmado: boolean;
  nombre: string;
}

const CLAVES: Record<string, string[]> = {
  categorias: ["user_id", "id"],
  cuentas: ["user_id", "id"],
  movimientos: ["user_id", "id"],
  presupuestos: ["user_id", "categoria_id"],
  metas: ["user_id", "id"],
  reglas: ["user_id", "patron"],
};

export function fakeSupabase(opciones: { confirmarCorreo?: boolean } = {}) {
  const usuarios: UsuarioFalso[] = [];
  const tablas: Record<string, Fila[]> = Object.fromEntries(Object.keys(CLAVES).map((t) => [t, []]));
  let sesion: { user: { id: string; email: string; user_metadata: { nombre: string } } } | null = null;
  const oyentes = new Set<(e: Evento, s: typeof sesion) => void>();
  const llamadas: string[] = [];

  const avisar = (e: Evento) => oyentes.forEach((f) => f(e, sesion));
  const abrir = (u: UsuarioFalso) => {
    sesion = { user: { id: u.id, email: u.email, user_metadata: { nombre: u.nombre } } };
  };
  const uid = () => sesion?.user.id ?? null;
  const err = (code: string, message: string) => ({ code, message });

  function consulta(tabla: string) {
    const filtros: [string, unknown][] = [];
    let modo: "select" | "delete" = "select";
    let cuenta = false;
    let rango: [number, number] | null = null;
    const ejecutar = () => {
      const yo = uid();
      if (!yo) return { data: null, error: err("42501", "permission denied") };
      const visibles = tablas[tabla].filter((f) => f.user_id === yo && filtros.every(([k, v]) => f[k] === v));
      if (modo === "delete") {
        tablas[tabla] = tablas[tabla].filter((f) => !visibles.includes(f));
        return { data: null, error: null };
      }
      if (cuenta) return { data: null, count: visibles.length, error: null };
      const datos = rango ? visibles.slice(rango[0], rango[1] + 1) : visibles;
      return { data: structuredClone(datos), error: null };
    };
    const q = {
      select(_cols?: string, o?: { count?: string; head?: boolean }) {
        cuenta = !!o?.head;
        return q;
      },
      range(a: number, b: number) {
        rango = [a, b];
        return q;
      },
      order() {
        return q;
      },
      eq(k: string, v: unknown) {
        filtros.push([k, v]);
        return q;
      },
      delete() {
        modo = "delete";
        llamadas.push(`delete:${tabla}`);
        return q;
      },
      upsert(filas: Fila | Fila[], o?: { ignoreDuplicates?: boolean }) {
        llamadas.push(`upsert:${tabla}`);
        const yo = uid();
        if (!yo) return Promise.resolve({ error: err("42501", "permission denied") });
        for (const f of Array.isArray(filas) ? filas : [filas]) {
          if (f.user_id !== yo) return Promise.resolve({ error: err("42501", "new row violates row-level security policy") });
          const clave = CLAVES[tabla];
          const i = tablas[tabla].findIndex((x) => clave.every((k) => x[k] === f[k]));
          if (i < 0) tablas[tabla].push({ ...f });
          else if (!o?.ignoreDuplicates) tablas[tabla][i] = { ...f };
        }
        return Promise.resolve({ error: null });
      },
      then(ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) {
        return Promise.resolve(ejecutar()).then(ok, mal);
      },
    };
    return q;
  }

  const cliente = {
    auth: {
      async getSession() {
        return { data: { session: sesion } };
      },
      onAuthStateChange(cb: (e: Evento, s: typeof sesion) => void) {
        oyentes.add(cb);
        queueMicrotask(() => cb("INITIAL_SESSION", sesion));
        return { data: { subscription: { unsubscribe: () => oyentes.delete(cb) } } };
      },
      async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { nombre?: string } } }) {
        llamadas.push("signUp");
        if (usuarios.some((u) => u.email === email)) {
          return opciones.confirmarCorreo
            ? { data: { user: { id: "x", identities: [] }, session: null }, error: null }
            : { data: { user: null, session: null }, error: err("user_already_exists", "User already registered") };
        }
        const u: UsuarioFalso = { id: `u${usuarios.length + 1}-0000-0000-0000-000000000000`, email, clave: password, confirmado: !opciones.confirmarCorreo, nombre: options?.data?.nombre ?? "" };
        usuarios.push(u);
        if (opciones.confirmarCorreo) return { data: { user: { id: u.id, identities: [{}] }, session: null }, error: null };
        abrir(u);
        avisar("SIGNED_IN");
        return { data: { user: { id: u.id, identities: [{}] }, session: sesion }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        llamadas.push("signIn");
        const u = usuarios.find((x) => x.email === email && x.clave === password);
        if (!u) return { data: { session: null }, error: err("invalid_credentials", "Invalid login credentials") };
        if (!u.confirmado) return { data: { session: null }, error: err("email_not_confirmed", "Email not confirmed") };
        abrir(u);
        avisar("SIGNED_IN");
        return { data: { session: sesion }, error: null };
      },
      async signOut() {
        sesion = null;
        avisar("SIGNED_OUT");
        return { error: null };
      },
      async resetPasswordForEmail() {
        llamadas.push("reset");
        return { data: {}, error: null };
      },
      async resend() {
        llamadas.push("resend");
        return { data: {}, error: null };
      },
      /** El código del correo es siempre 123456 en las pruebas; token_hash "bueno" es el del botón. */
      async verifyOtp(p: { email?: string; token?: string; token_hash?: string; type: string }) {
        llamadas.push(`verify:${p.type}`);
        const u = p.token_hash === "bueno" ? usuarios[usuarios.length - 1] : usuarios.find((x) => x.email === p.email);
        if (!u || (p.token !== undefined && p.token !== "123456") || (p.token_hash !== undefined && p.token_hash !== "bueno")) {
          return { data: { session: null }, error: err("otp_expired", "Token has expired or is invalid") };
        }
        u.confirmado = true;
        abrir(u);
        avisar(p.type === "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN");
        return { data: { session: sesion }, error: null };
      },
      async updateUser(cambios: { password?: string; data?: { nombre?: string } }) {
        const u = usuarios.find((x) => x.id === uid());
        if (!u) return { data: null, error: err("no_session", "Auth session missing") };
        if (cambios.password) u.clave = cambios.password;
        if (cambios.data?.nombre) u.nombre = cambios.data.nombre;
        abrir(u);
        avisar("USER_UPDATED");
        return { data: { user: sesion!.user }, error: null };
      },
    },
    from: consulta,
    async rpc(nombre: string, args?: { datos?: Record<string, Fila[]> }) {
      llamadas.push(`rpc:${nombre}`);
      const yo = uid();
      if (!yo) return { data: null, error: err("42501", "Hace falta iniciar sesión") };
      if (nombre === "eliminar_mi_cuenta") {
        for (const t of Object.keys(tablas)) tablas[t] = tablas[t].filter((f) => f.user_id !== yo);
        usuarios.splice(
          usuarios.findIndex((u) => u.id === yo),
          1,
        );
        return { data: null, error: null };
      }
      if (nombre === "reemplazar_todo") {
        const d = args!.datos!;
        for (const t of Object.keys(tablas)) tablas[t] = tablas[t].filter((f) => f.user_id !== yo);
        const m = (l: Fila[] | undefined, f: (x: Fila) => Fila) => (l ?? []).map((x) => ({ user_id: yo, ...f(x) }));
        tablas.categorias.push(...m(d.categories, (c) => ({ id: c.id, nombre: c.name, tipo: c.kind, grupo: c.group, icono: c.icon, color: c.color })));
        tablas.cuentas.push(...m(d.accounts, (a) => ({ id: a.id, nombre: a.name, tipo: a.type })));
        tablas.movimientos.push(...m(d.transactions, (t) => ({ id: t.id, tipo: t.kind, monto: t.amount, categoria_id: t.categoryId, cuenta_id: t.accountId, fecha: t.date, nota: t.note, creado_en: t.createdAt })));
        tablas.presupuestos.push(...m(d.budgets, (b) => ({ categoria_id: b.categoryId, limite: b.limit })));
        tablas.metas.push(...m(d.goals, (g) => ({ id: g.id, nombre: g.name, objetivo: g.target, ahorrado: g.saved, fecha_limite: g.deadline ?? null, creado_en: g.createdAt })));
        tablas.reglas.push(...m(d.rules, (r) => ({ patron: r.pattern, categoria_id: r.categoryId })));
        return { data: null, error: null };
      }
      return { data: null, error: err("PGRST202", "no existe") };
    },
  };

  return {
    cliente,
    tablas,
    usuarios,
    llamadas,
    /** Simula tocar el enlace del correo de confirmación. */
    confirmar(email: string) {
      const u = usuarios.find((x) => x.email === email)!;
      u.confirmado = true;
      abrir(u);
      avisar("SIGNED_IN");
    },
    /** Simula tocar el enlace de "olvidé mi contraseña". */
    abrirEnlaceRecuperacion(email: string) {
      abrir(usuarios.find((x) => x.email === email)!);
      avisar("PASSWORD_RECOVERY");
    },
    crearUsuario(email: string, clave: string, nombre = "Prueba") {
      usuarios.push({ id: `u${usuarios.length + 1}-0000-0000-0000-000000000000`, email, clave, confirmado: true, nombre });
    },
  };
}
