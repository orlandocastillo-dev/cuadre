import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { nube } from "../data/nube";

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
}

export type Resultado = { ok: true } | { ok: false; mensaje: string; campo?: "nombre" | "email" | "clave" | "clave2" | "codigo" | "acepta" | "actual"; bloqueo?: number };

export const CLAVE_MINIMA = 8;

/** Fecha de la versión vigente de Privacidad y Términos (landing/privacidad.html y terminos.html). */
export const VERSION_LEGAL = "2026-10-21";

export function usuarioDe(s: Session | null): Usuario | null {
  if (!s?.user) return null;
  const nombre = String(s.user.user_metadata?.nombre ?? "").trim();
  return { id: s.user.id, email: s.user.email ?? "", nombre: nombre || (s.user.email ?? "").split("@")[0] };
}

/** A dónde vuelven los enlaces del correo (confirmar cuenta, cambiar contraseña): esta misma app. */
function regreso(): string {
  return window.location.origin + window.location.pathname;
}

export const emailValido = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());

/** Qué tan fuerte es la contraseña, de 0 a 4, con un consejo. */
export function fuerzaClave(clave: string): { nivel: 0 | 1 | 2 | 3 | 4; texto: string } {
  if (!clave) return { nivel: 0, texto: "" };
  if (clave.length < CLAVE_MINIMA) return { nivel: 1, texto: `Mínimo ${CLAVE_MINIMA} caracteres` };
  let puntos = 0;
  if (/[a-z]/.test(clave) && /[A-Z]/.test(clave)) puntos++;
  if (/\d/.test(clave)) puntos++;
  if (/[^A-Za-z0-9]/.test(clave)) puntos++;
  if (clave.length >= 12) puntos++;
  if (/^(.)\1+$/.test(clave) || /^(12345678|password|contraseña|qwerty)/i.test(clave)) puntos = 0;
  if (puntos <= 1) return { nivel: 2, texto: "Aceptable. Mezcla números y mayúsculas para hacerla más segura" };
  if (puntos === 2) return { nivel: 3, texto: "Buena" };
  return { nivel: 4, texto: "Muy segura" };
}

/** Errores de Supabase Auth en palabras normales. */
export function mensajeAuth(error: unknown): string {
  const e = error as { message?: string; code?: string; status?: number };
  const m = `${e?.code ?? ""} ${e?.message ?? ""}`;
  if (/invalid_credentials|Invalid login credentials/i.test(m)) return "El correo o la contraseña no coinciden.";
  if (/email_not_confirmed|Email not confirmed/i.test(m)) return "Todavía no has confirmado tu correo. Revisa tu bandeja de entrada (y la de spam).";
  if (/user_already_exists|already registered/i.test(m)) return "Ya hay una cuenta con ese correo. Entra con tu contraseña o recupérala.";
  if (/weak_password|Password should/i.test(m)) return `La contraseña es muy débil. Usa al menos ${CLAVE_MINIMA} caracteres, con letras y números.`;
  if (/same_password|different from the old/i.test(m)) return "La nueva contraseña debe ser distinta de la anterior.";
  if (/over_email_send_rate_limit|rate limit|too many/i.test(m) || e?.status === 429) return "Hiciste muchos intentos seguidos. Espera un minuto e inténtalo de nuevo.";
  if (/email_address_invalid|invalid.*email/i.test(m)) return "Ese correo no parece válido.";
  if (/signup_disabled|Signups not allowed/i.test(m)) return "Por ahora no se pueden crear cuentas nuevas.";
  // Supabase responde lo mismo si el código está mal o si ya venció.
  if (/otp_expired|otp_disabled|token has expired|is invalid/i.test(m)) return "El código no es correcto o ya venció. Revísalo o pide uno nuevo.";
  if (/fetch|network|Failed to/i.test(m)) return "No hay conexión. Revisa el internet e inténtalo de nuevo.";
  return "Algo salió mal. Inténtalo de nuevo en un momento.";
}

async function hacer(fn: () => Promise<{ error: unknown }>): Promise<Resultado> {
  try {
    const { error } = await fn();
    return error ? { ok: false, mensaje: mensajeAuth(error) } : { ok: true };
  } catch (e) {
    return { ok: false, mensaje: mensajeAuth(e) };
  }
}

export async function sesionActual(): Promise<Session | null> {
  const db = await nube();
  const { data } = await db.auth.getSession();
  return data.session;
}

export async function escucharSesion(cb: (evento: AuthChangeEvent, s: Session | null) => void): Promise<() => void> {
  const db = await nube();
  const { data } = db.auth.onAuthStateChange(cb);
  return () => data.subscription.unsubscribe();
}

/**
 * Crea la cuenta. Si el proyecto pide confirmar el correo, Supabase manda un código y un enlace;
 * la sesión se abre al escribir el código o al tocar el enlace. Si no, queda abierta de una vez.
 */
export async function crearCuenta(nombre: string, email: string, clave: string, acepta = false): Promise<Resultado & { confirmar?: boolean }> {
  if (nombre.trim().length < 2) return { ok: false, campo: "nombre", mensaje: "Escribe tu nombre." };
  if (!emailValido(email)) return { ok: false, campo: "email", mensaje: "Ese correo no parece válido." };
  if (clave.length < CLAVE_MINIMA) return { ok: false, campo: "clave", mensaje: `La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres.` };
  if (!acepta) return { ok: false, campo: "acepta", mensaje: "Para crear la cuenta necesitas aceptar los términos y la política de privacidad." };
  try {
    const db = await nube();
    const { data, error } = await db.auth.signUp({
      email: email.trim().toLowerCase(),
      password: clave,
      // La aceptación queda guardada en la cuenta, con la versión y la fecha (prueba de la autorización, Ley 1581).
      options: { data: { nombre: nombre.trim(), acepto_legal: { version: VERSION_LEGAL, fecha: new Date().toISOString() } }, emailRedirectTo: regreso() },
    });
    if (error) return { ok: false, mensaje: mensajeAuth(error) };
    // Con confirmación activada y un correo que ya existía, Supabase responde sin identidades.
    if (data.user && data.user.identities?.length === 0) {
      return { ok: false, campo: "email", mensaje: "Ya hay una cuenta con ese correo. Entra con tu contraseña o recupérala." };
    }
    return { ok: true, confirmar: !data.session };
  } catch (e) {
    return { ok: false, mensaje: mensajeAuth(e) };
  }
}

/** "15 minutos", "1 hora", "2 horas"… */
export function duracion(segundos: number): string {
  const min = Math.max(1, Math.ceil(segundos / 60));
  if (min < 60) return min === 1 ? "1 minuto" : `${min} minutos`;
  const h = Math.ceil(min / 60);
  return h === 1 ? "1 hora" : `${h} horas`;
}

const mensajeBloqueo = (seg: number) =>
  `Por seguridad, bloqueamos la entrada con este correo durante ${duracion(seg)} por varios intentos fallidos. Si olvidaste la contraseña, puedes recuperarla.`;

/**
 * Entrar con correo y contraseña. Tras 5 contraseñas equivocadas seguidas, la base bloquea ese correo
 * (15 min, luego 30, 60…). Si las funciones de bloqueo no responden, se entra igual: Supabase además
 * limita los intentos por dirección IP.
 */
export async function entrar(email: string, clave: string): Promise<Resultado> {
  if (!emailValido(email)) return { ok: false, campo: "email", mensaje: "Ese correo no parece válido." };
  if (!clave) return { ok: false, campo: "clave", mensaje: "Escribe tu contraseña." };
  const db = await nube().catch(() => null);
  if (!db) return { ok: false, mensaje: "La nube no está disponible." };
  const correo = email.trim().toLowerCase();
  try {
    const { data: falta } = await db.rpc("bloqueo_restante", { correo });
    if (typeof falta === "number" && falta > 0) return { ok: false, mensaje: mensajeBloqueo(falta), bloqueo: falta };

    const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });
    if (!error) {
      void db.rpc("login_exitoso");
      return { ok: true };
    }
    if (/invalid_credentials|Invalid login credentials/i.test(`${(error as { code?: string }).code ?? ""} ${error.message}`)) {
      const { data: bloqueo } = await db.rpc("registrar_fallo", { correo });
      if (typeof bloqueo === "number" && bloqueo > 0) return { ok: false, mensaje: mensajeBloqueo(bloqueo), bloqueo };
    }
    return { ok: false, mensaje: mensajeAuth(error) };
  } catch (e) {
    return { ok: false, mensaje: mensajeAuth(e) };
  }
}

/** Lo que trae el correo: un código de 6 dígitos (o de hasta 10 si el proyecto lo pide así). */
export const codigoValido = (c: string) => /^\d{6,10}$/.test(c.replace(/\s/g, ""));

/**
 * Confirma el correo (o abre el cambio de contraseña) con el código que llegó por correo.
 * A diferencia del enlace, sirve desde cualquier dispositivo: no depende de dónde se creó la cuenta.
 */
export async function verificarCodigo(email: string, codigo: string, tipo: "signup" | "recovery"): Promise<Resultado> {
  const token = codigo.replace(/\s/g, "");
  if (!codigoValido(token)) return { ok: false, campo: "codigo", mensaje: "Escribe el código de 6 dígitos que te llegó." };
  const db = await nube();
  return hacer(() => db.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: tipo }));
}

/**
 * El botón del correo trae ?token_hash=...&type=... y se puede abrir en otro celular o computador.
 * Devuelve el tipo si había uno en la dirección (y la deja limpia), o null.
 */
export async function abrirEnlaceDelCorreo(): Promise<{ tipo: string; r: Resultado } | null> {
  const q = new URLSearchParams(window.location.search);
  const token_hash = q.get("token_hash");
  const tipo = q.get("type");
  if (!token_hash || !tipo) return null;
  window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  const db = await nube();
  const r = await hacer(() => db.auth.verifyOtp({ token_hash, type: tipo as "signup" | "recovery" | "email" }));
  return { tipo, r };
}

export async function reenviarConfirmacion(email: string): Promise<Resultado> {
  const db = await nube();
  return hacer(() => db.auth.resend({ type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: regreso() } }));
}

/** Manda el código (y el enlace) para poner una contraseña nueva. Por seguridad no dice si el correo existe. */
export async function recuperarClave(email: string): Promise<Resultado> {
  if (!emailValido(email)) return { ok: false, campo: "email", mensaje: "Ese correo no parece válido." };
  const db = await nube();
  return hacer(() => db.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: regreso() }));
}

/**
 * Pone una contraseña nueva. Desde "Tu cuenta" se pide la actual (si alguien encuentra la sesión
 * abierta, no puede cambiarla); desde el enlace de "olvidé mi contraseña" no hace falta.
 */
export async function cambiarClave(clave: string, actual?: string): Promise<Resultado> {
  if (actual !== undefined && !actual) return { ok: false, campo: "actual", mensaje: "Escribe tu contraseña actual." };
  if (clave.length < CLAVE_MINIMA) return { ok: false, campo: "clave", mensaje: `La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres.` };
  const db = await nube();
  if (actual !== undefined) {
    const { data } = await db.auth.getSession();
    const email = data.session?.user.email;
    if (!email) return { ok: false, mensaje: "Tu sesión se cerró. Vuelve a entrar." };
    const r = await entrar(email, actual);
    if (!r.ok) return /no coinciden/.test(r.mensaje) ? { ok: false, campo: "actual", mensaje: "La contraseña actual no es correcta." } : r;
  }
  return hacer(() => db.auth.updateUser({ password: clave }));
}

/** Cierra la sesión en todos los celulares y computadores donde esté abierta, incluido este. */
export async function salirDeTodo(): Promise<Resultado> {
  const db = await nube();
  return hacer(() => db.auth.signOut({ scope: "global" }));
}

export async function cambiarNombre(nombre: string): Promise<Resultado> {
  if (nombre.trim().length < 2) return { ok: false, campo: "nombre", mensaje: "Escribe tu nombre." };
  const db = await nube();
  return hacer(() => db.auth.updateUser({ data: { nombre: nombre.trim() } }));
}

export async function salir(): Promise<void> {
  const db = await nube();
  await db.auth.signOut({ scope: "local" });
}

/** Borra la cuenta y todos sus datos (función eliminar_mi_cuenta en la base). */
export async function eliminarCuenta(): Promise<Resultado> {
  const db = await nube();
  const r = await hacer(async () => db.rpc("eliminar_mi_cuenta"));
  if (r.ok) await db.auth.signOut({ scope: "local" }).catch(() => undefined);
  return r;
}
