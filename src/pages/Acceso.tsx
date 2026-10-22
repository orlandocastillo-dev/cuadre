import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  cambiarClave,
  CLAVE_MINIMA,
  crearCuenta,
  entrar,
  fuerzaClave,
  reenviarConfirmacion,
  recuperarClave,
  type Resultado,
  verificarCodigo,
} from "../auth/cuenta";
import { Icon } from "../components/Icon";

export type VistaAcceso = "entrar" | "crear" | "recuperar" | "revisar" | "nueva-clave";

interface Props {
  vista?: VistaAcceso;
  /** Usar la app sin cuenta, con los datos en este dispositivo. */
  onSinCuenta?: () => void;
  /** Se llama al terminar de poner la contraseña nueva. */
  onClaveCambiada?: () => void;
  /** Mensaje que llega de afuera (por ejemplo, "el enlace venció"). */
  aviso?: string | null;
}

/** Entrar, crear cuenta, recuperar la contraseña y confirmar el correo: todo en una pantalla. */
export function Acceso({ vista: inicial = "entrar", onSinCuenta, onClaveCambiada, aviso }: Props) {
  const [vista, setVista] = useState<VistaAcceso>(inicial);
  const [email, setEmail] = useState("");

  return (
    <main className="acceso">
      <section className="acceso__lado">
        {window.location.protocol !== "file:" && (
          <a className="welcome__back" href="../">
            ‹ Volver a la página de Cuadre
          </a>
        )}
        <p className="brand brand--big">
          <span className="brand__mark" aria-hidden="true" />
          cuadre
        </p>
        <h1 className="acceso__titulo">Tus cuentas, en todos tus dispositivos.</h1>
        <ul className="acceso__puntos">
          <li>
            <Icon name="check" size={18} /> Registras en el celular y lo ves en el computador.
          </li>
          <li>
            <Icon name="check" size={18} /> Si cambias de celular, no pierdes nada.
          </li>
          <li>
            <Icon name="check" size={18} /> Solo tú puedes ver tus movimientos.
          </li>
        </ul>
      </section>

      <section className="acceso__tarjeta" aria-live="polite">
        {aviso && (
          <p className="acceso__aviso" role="status">
            {aviso}
          </p>
        )}
        {(vista === "entrar" || vista === "crear") && (
          <div className="acceso__pestanas" role="tablist" aria-label="Cuenta">
            <button type="button" role="tab" aria-selected={vista === "entrar"} onClick={() => setVista("entrar")}>
              Entrar
            </button>
            <button type="button" role="tab" aria-selected={vista === "crear"} onClick={() => setVista("crear")}>
              Crear cuenta
            </button>
          </div>
        )}

        {vista === "entrar" && <FormEntrar email={email} setEmail={setEmail} onOlvide={() => setVista("recuperar")} onSinConfirmar={() => setVista("revisar")} />}
        {vista === "crear" && <FormCrear email={email} setEmail={setEmail} onCreada={(confirmar) => confirmar && setVista("revisar")} />}
        {vista === "recuperar" && <FormRecuperar email={email} setEmail={setEmail} onVolver={() => setVista("entrar")} />}
        {vista === "revisar" && <RevisarCorreo email={email} onOtro={() => setVista("crear")} onEntrar={() => setVista("entrar")} />}
        {vista === "nueva-clave" && <FormNuevaClave onListo={onClaveCambiada} />}

        {onSinCuenta && (vista === "entrar" || vista === "crear") && (
          <div className="acceso__sin-cuenta">
            <span>¿Solo quieres mirar?</span>
            <button type="button" className="link" onClick={onSinCuenta}>
              Usar sin cuenta
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------

function FormEntrar({ email, setEmail, onOlvide, onSinConfirmar }: { email: string; setEmail: (v: string) => void; onOlvide: () => void; onSinConfirmar: () => void }) {
  const [clave, setClave] = useState("");
  const [r, setR] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const res = await entrar(email, clave);
    setEnviando(false);
    setR(res);
    if (!res.ok && /confirmado/.test(res.mensaje)) onSinConfirmar();
    // Si entra bien, la app cambia sola al detectar la sesión.
  };

  return (
    <form className="form acceso__form" onSubmit={enviar} noValidate>
      <h2>Qué bueno verte</h2>
      <Campo etiqueta="Correo" error={r && !r.ok && r.campo === "email" ? r.mensaje : null}>
        {(id, desc) => <input id={id} aria-describedby={desc} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}
      </Campo>
      <Campo etiqueta="Contraseña" error={r && !r.ok && r.campo === "clave" ? r.mensaje : null} extra={<button type="button" className="link link--small" onClick={onOlvide}>¿La olvidaste?</button>}>
        {(id, desc) => <ClaveInput id={id} describedBy={desc} value={clave} onChange={setClave} autoComplete="current-password" />}
      </Campo>
      {r && !r.ok && !r.campo && <p className="form-error" role="alert">{r.mensaje}</p>}
      <button type="submit" className="btn btn--primary btn--big" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

function FormCrear({ email, setEmail, onCreada }: { email: string; setEmail: (v: string) => void; onCreada: (confirmar: boolean) => void }) {
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [r, setR] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fuerza = fuerzaClave(clave);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const res = await crearCuenta(nombre, email, clave);
    setEnviando(false);
    setR(res);
    if (res.ok) onCreada(!!res.confirmar);
  };
  const err = (c: string) => (r && !r.ok && r.campo === c ? r.mensaje : null);

  return (
    <form className="form acceso__form" onSubmit={enviar} noValidate>
      <h2>Crea tu cuenta</h2>
      <Campo etiqueta="Tu nombre" error={err("nombre")}>
        {(id, desc) => <input id={id} aria-describedby={desc} autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />}
      </Campo>
      <Campo etiqueta="Correo" error={err("email")}>
        {(id, desc) => <input id={id} aria-describedby={desc} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
      </Campo>
      <Campo etiqueta="Contraseña" error={err("clave")} ayuda={`Mínimo ${CLAVE_MINIMA} caracteres.`}>
        {(id, desc) => <ClaveInput id={id} describedBy={desc} value={clave} onChange={setClave} autoComplete="new-password" />}
      </Campo>
      {clave && (
        <div className="fuerza" data-nivel={fuerza.nivel} aria-live="polite">
          <span className="fuerza__barra" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="fuerza__texto">{fuerza.texto}</span>
        </div>
      )}
      {r && !r.ok && !r.campo && <p className="form-error" role="alert">{r.mensaje}</p>}
      <button type="submit" className="btn btn--primary btn--big" disabled={enviando}>
        {enviando ? "Creando la cuenta…" : "Crear cuenta"}
      </button>
      <p className="muted small acceso__legal">Tus datos son solo tuyos: no se comparten ni se venden.</p>
    </form>
  );
}

function FormRecuperar({ email, setEmail, onVolver }: { email: string; setEmail: (v: string) => void; onVolver: () => void }) {
  const [r, setR] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setR(await recuperarClave(email));
    setEnviando(false);
  };

  if (r?.ok) {
    return (
      <div className="acceso__mensaje">
        <span className="acceso__icono">
          <Icon name="check" size={26} />
        </span>
        <h2>Revisa tu correo</h2>
        <p className="muted">
          Si hay una cuenta con <b>{email.trim()}</b>, te llegará un enlace para poner una contraseña nueva. Ábrelo en este mismo celular o computador. Puede tardar un par de minutos; mira también en spam.
        </p>
        <TengoCodigo email={email} />
        <button type="button" className="link" onClick={onVolver}>
          Volver a entrar
        </button>
      </div>
    );
  }

  return (
    <form className="form acceso__form" onSubmit={enviar} noValidate>
      <button type="button" className="link link--volver" onClick={onVolver}>
        <Icon name="left" size={16} /> Volver
      </button>
      <h2>¿Olvidaste tu contraseña?</h2>
      <p className="muted">Escribe tu correo y te mandamos un enlace para crear una nueva.</p>
      <Campo etiqueta="Correo" error={r && !r.ok && r.campo === "email" ? r.mensaje : null}>
        {(id, desc) => <input id={id} aria-describedby={desc} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}
      </Campo>
      {r && !r.ok && !r.campo && <p className="form-error" role="alert">{r.mensaje}</p>}
      <button type="submit" className="btn btn--primary btn--big" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}

function RevisarCorreo({ email, onOtro, onEntrar }: { email: string; onOtro: () => void; onEntrar: () => void }) {
  const [espera, setEspera] = useState(60);
  const [r, setR] = useState<Resultado | null>(null);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const reenviar = async () => {
    setR(await reenviarConfirmacion(email));
    setEspera(60);
  };

  return (
    <div className="acceso__mensaje">
      <span className="acceso__icono">
        <Icon name="check" size={26} />
      </span>
      <h2>Confirma tu correo</h2>
      <p className="muted">
        Te enviamos un código de 6 dígitos a <b>{email.trim() || "tu correo"}</b>. Escríbelo aquí, o toca el botón del correo desde cualquier celular o computador.
      </p>
      {email && <CodigoCorreo email={email} tipo="signup" boton="Confirmar" />}
      {r && <p className={r.ok ? "notice" : "form-error"}>{r.ok ? "Listo, te lo enviamos otra vez." : r.mensaje}</p>}
      <div className="acceso__acciones">
        <button type="button" className="btn btn--quiet" onClick={reenviar} disabled={espera > 0 || !email}>
          {espera > 0 ? `Reenviar en ${espera} s` : "Reenviar el correo"}
        </button>
        <button type="button" className="btn btn--quiet" onClick={onOtro}>
          Usar otro correo
        </button>
      </div>
      <button type="button" className="link" onClick={onEntrar}>
        Ya lo confirmé, quiero entrar
      </button>
    </div>
  );
}

function FormNuevaClave({ onListo }: { onListo?: () => void }) {
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [r, setR] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fuerza = fuerzaClave(clave);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (clave !== clave2) return setR({ ok: false, campo: "clave2", mensaje: "Las dos contraseñas no son iguales." });
    setEnviando(true);
    const res = await cambiarClave(clave);
    setEnviando(false);
    setR(res);
    if (res.ok) setTimeout(() => onListo?.(), 1200);
  };

  if (r?.ok) {
    return (
      <div className="acceso__mensaje">
        <span className="acceso__icono">
          <Icon name="check" size={26} />
        </span>
        <h2>Contraseña actualizada</h2>
        <p className="muted">Ya puedes seguir con tus cuentas.</p>
      </div>
    );
  }

  return (
    <form className="form acceso__form" onSubmit={enviar} noValidate>
      <h2>Pon una contraseña nueva</h2>
      <Campo etiqueta="Contraseña nueva" error={r && !r.ok && r.campo === "clave" ? r.mensaje : null} ayuda={`Mínimo ${CLAVE_MINIMA} caracteres.`}>
        {(id, desc) => <ClaveInput id={id} describedBy={desc} value={clave} onChange={setClave} autoComplete="new-password" autoFocus />}
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
        {(id, desc) => <ClaveInput id={id} describedBy={desc} value={clave2} onChange={setClave2} autoComplete="new-password" />}
      </Campo>
      {r && !r.ok && !r.campo && <p className="form-error" role="alert">{r.mensaje}</p>}
      <button type="submit" className="btn btn--primary btn--big" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}

/**
 * El código que llega por correo. Al confirmarlo, Supabase abre la sesión y la app sigue sola
 * (o pasa a "pon una contraseña nueva" si es para recuperarla).
 */
function CodigoCorreo({ email, tipo, boton }: { email: string; tipo: "signup" | "recovery"; boton: string }) {
  const [codigo, setCodigo] = useState("");
  const [r, setR] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const res = await verificarCodigo(email, codigo, tipo);
    setR(res);
    if (!res.ok) setEnviando(false);
    // Si sale bien, la app cambia de pantalla al detectar la sesión.
  };

  return (
    <form className="form acceso__codigo" onSubmit={enviar} noValidate>
      <Campo etiqueta="Código" error={r && !r.ok ? r.mensaje : null}>
        {(id, desc) => (
          <input
            id={id}
            aria-describedby={desc}
            className="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        )}
      </Campo>
      <button type="submit" className="btn btn--primary btn--big" disabled={enviando || codigo.length < 6}>
        {enviando ? "Revisando…" : boton}
      </button>
    </form>
  );
}

/** Por si el correo trae un código en vez de (o además de) el enlace. */
function TengoCodigo({ email }: { email: string }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto)
    return (
      <button type="button" className="link link--small" onClick={() => setAbierto(true)}>
        ¿Te llegó un código? Escríbelo aquí
      </button>
    );
  return <CodigoCorreo email={email} tipo="recovery" boton="Seguir" />;
}

// ---------------------------------------------------------------------------

/** Campo con etiqueta, ayuda y error unidos al input para lectores de pantalla. */
export function Campo({ etiqueta, error, ayuda, extra, children }: { etiqueta: string; error?: string | null; ayuda?: string; extra?: ReactNode; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const desc = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
  return (
    <div className={`field ${error ? "field--error" : ""}`}>
      <div className="field__top">
        <label className="field__label" htmlFor={id}>
          {etiqueta}
        </label>
        {extra}
      </div>
      {children(id, desc)}
      {error ? (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      ) : (
        ayuda && (
          <span className="field__ayuda muted small" id={`${id}-ayuda`}>
            {ayuda}
          </span>
        )
      )}
    </div>
  );
}

/** Contraseña con botón para mostrarla u ocultarla. */
export function ClaveInput({ id, value, onChange, autoComplete, describedBy, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; describedBy?: string; autoFocus?: boolean }) {
  const [ver, setVer] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="clave">
      <input
        ref={ref}
        id={id}
        type={ver ? "text" : "password"}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        required
      />
      <button
        type="button"
        className="clave__ojo"
        onClick={() => {
          setVer((v) => !v);
          ref.current?.focus();
        }}
        aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={ver}
      >
        <Icon name={ver ? "eyeOff" : "eye"} size={18} />
      </button>
    </div>
  );
}
