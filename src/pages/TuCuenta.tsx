import { useState, type FormEvent } from "react";
import { cambiarClave, cambiarNombre, CLAVE_MINIMA, eliminarCuenta, fuerzaClave, salirDeTodo, type Resultado } from "../auth/cuenta";
import { useCuenta } from "../auth/CuentaContext";
import { ClaveInput, Campo } from "./Acceso";

/** Sección "Tu cuenta" de Ajustes: nombre, contraseña, cerrar sesión y eliminar la cuenta. */
export function TuCuenta() {
  const { modo, usuario, nubeDisponible, irAAcceso, cerrarSesion, actualizarUsuario } = useCuenta();
  const [abierto, setAbierto] = useState<null | "nombre" | "clave" | "eliminar">(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  if (modo === "local") {
    if (!nubeDisponible) return null;
    return (
      <section className="settings cuenta">
        <div className="setting">
          <div>
            <p className="setting__title">Guarda tus cuentas en la nube</p>
            <p className="muted small">Con una cuenta ves lo mismo en el celular y en el computador, y no pierdes nada si cambias de equipo. Lo que tienes aquí se puede pasar a la cuenta.</p>
          </div>
          <div className="setting__actions">
            <button type="button" className="btn btn--small btn--primary" onClick={() => irAAcceso("crear")}>
              Crear cuenta
            </button>
            <button type="button" className="btn btn--small" onClick={() => irAAcceso("entrar")}>
              Entrar
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!usuario) return null;
  const inicial = (usuario.nombre || usuario.email).trim().charAt(0).toUpperCase();

  return (
    <section className="settings cuenta" aria-label="Tu cuenta">
      <div className="cuenta__cab">
        <span className="cuenta__avatar" aria-hidden="true">
          {inicial}
        </span>
        <div>
          <p className="cuenta__nombre">{usuario.nombre}</p>
          <p className="muted small">{usuario.email}</p>
        </div>
        <button type="button" className="btn btn--small cuenta__salir" onClick={() => void cerrarSesion()}>
          Cerrar sesión
        </button>
      </div>

      <div className="setting setting--col">
        <div className="setting__fila">
          <div>
            <p className="setting__title">Nombre</p>
            <p className="muted small">Así te saluda la app.</p>
          </div>
          <button type="button" className="btn btn--small" onClick={() => setAbierto(abierto === "nombre" ? null : "nombre")} aria-expanded={abierto === "nombre"}>
            Cambiar
          </button>
        </div>
        {abierto === "nombre" && (
          <FormNombre
            actual={usuario.nombre}
            onListo={(n) => {
              actualizarUsuario({ ...usuario, nombre: n });
              setAbierto(null);
              setMensaje("Listo, cambiamos tu nombre.");
            }}
          />
        )}
      </div>

      <div className="setting setting--col">
        <div className="setting__fila">
          <div>
            <p className="setting__title">Contraseña</p>
            <p className="muted small">Cámbiala si crees que alguien más la conoce.</p>
          </div>
          <button type="button" className="btn btn--small" onClick={() => setAbierto(abierto === "clave" ? null : "clave")} aria-expanded={abierto === "clave"}>
            Cambiar
          </button>
        </div>
        {abierto === "clave" && (
          <FormClave
            onListo={() => {
              setAbierto(null);
              setMensaje("Listo, tu contraseña quedó cambiada.");
            }}
          />
        )}
      </div>

      <div className="setting setting--col">
        <div className="setting__fila">
          <div>
            <p className="setting__title">Sesiones abiertas</p>
            <p className="muted small">Si perdiste el celular o entraste en un computador ajeno, cierra la sesión en todos lados.</p>
          </div>
          <button
            type="button"
            className="btn btn--small"
            onClick={async () => {
              const r = await salirDeTodo();
              if (!r.ok) setMensaje(r.mensaje);
              // Si sale bien, la app vuelve sola a la pantalla de entrar.
            }}
          >
            Cerrar en todos
          </button>
        </div>
      </div>

      <div className="setting setting--col">
        <div className="setting__fila">
          <div>
            <p className="setting__title">Eliminar la cuenta</p>
            <p className="muted small">Borra la cuenta y todos sus movimientos, metas y presupuestos. No se puede deshacer.</p>
          </div>
          <button type="button" className="btn btn--small btn--danger" onClick={() => setAbierto(abierto === "eliminar" ? null : "eliminar")} aria-expanded={abierto === "eliminar"}>
            Eliminar
          </button>
        </div>
        {abierto === "eliminar" && <FormEliminar email={usuario.email} />}
      </div>

      {mensaje && (
        <p className="notice" role="status">
          {mensaje}
        </p>
      )}

      <p className="muted small cuenta__docs">
        Cómo cuidamos tus datos: <a href="../privacidad.html">Política de privacidad</a> · <a href="../terminos.html">Términos</a>
      </p>
    </section>
  );
}

function FormNombre({ actual, onListo }: { actual: string; onListo: (n: string) => void }) {
  const [nombre, setNombre] = useState(actual);
  const [r, setR] = useState<Resultado | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const res = await cambiarNombre(nombre);
    setR(res);
    if (res.ok) onListo(nombre.trim());
  };
  return (
    <form className="form cuenta__form" onSubmit={enviar} noValidate>
      <Campo etiqueta="Tu nombre" error={r && !r.ok ? r.mensaje : null}>
        {(id, d) => <input id={id} aria-describedby={d} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" autoFocus />}
      </Campo>
      <div className="form__actions">
        <button type="submit" className="btn btn--small btn--primary">
          Guardar
        </button>
      </div>
    </form>
  );
}

function FormClave({ onListo }: { onListo: () => void }) {
  const [actual, setActual] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [r, setR] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fuerza = fuerzaClave(clave);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (clave !== clave2) return setR({ ok: false, campo: "clave2", mensaje: "Las dos contraseñas no son iguales." });
    setEnviando(true);
    const res = await cambiarClave(clave, actual);
    setEnviando(false);
    setR(res);
    if (res.ok) onListo();
  };
  return (
    <form className="form cuenta__form" onSubmit={enviar} noValidate>
      <Campo etiqueta="Contraseña actual" error={r && !r.ok && r.campo === "actual" ? r.mensaje : null}>
        {(id, d) => <ClaveInput id={id} describedBy={d} value={actual} onChange={setActual} autoComplete="current-password" autoFocus />}
      </Campo>
      <Campo etiqueta="Contraseña nueva" error={r && !r.ok && r.campo !== "clave2" && r.campo !== "actual" ? r.mensaje : null} ayuda={`Mínimo ${CLAVE_MINIMA} caracteres.`}>
        {(id, d) => <ClaveInput id={id} describedBy={d} value={clave} onChange={setClave} autoComplete="new-password" />}
      </Campo>
      {clave && (
        <div className="fuerza" data-nivel={fuerza.nivel}>
          <span className="fuerza__barra" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="fuerza__texto">{fuerza.texto}</span>
        </div>
      )}
      <Campo etiqueta="Repítela" error={r && !r.ok && r.campo === "clave2" ? r.mensaje : null}>
        {(id, d) => <ClaveInput id={id} describedBy={d} value={clave2} onChange={setClave2} autoComplete="new-password" />}
      </Campo>
      <div className="form__actions">
        <button type="submit" className="btn btn--small btn--primary" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar contraseña"}
        </button>
      </div>
    </form>
  );
}

function FormEliminar({ email }: { email: string }) {
  const [texto, setTexto] = useState("");
  const [r, setR] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const coincide = texto.trim().toLowerCase() === email.toLowerCase();
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!coincide) return;
    setEnviando(true);
    setR(await eliminarCuenta());
    setEnviando(false);
    // Si se eliminó, la sesión se cierra y la app vuelve sola a la pantalla de entrar.
  };
  return (
    <form className="form cuenta__form cuenta__form--peligro" onSubmit={enviar} noValidate>
      <p className="small">
        Para confirmar, escribe tu correo: <b>{email}</b>. Si quieres guardar una copia, primero descarga el respaldo.
      </p>
      <Campo etiqueta="Tu correo" error={r && !r.ok ? r.mensaje : null}>
        {(id, d) => <input id={id} aria-describedby={d} value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" inputMode="email" />}
      </Campo>
      <div className="form__actions">
        <button type="submit" className="btn btn--small btn--danger" disabled={!coincide || enviando}>
          {enviando ? "Eliminando…" : "Eliminar mi cuenta para siempre"}
        </button>
      </div>
    </form>
  );
}
