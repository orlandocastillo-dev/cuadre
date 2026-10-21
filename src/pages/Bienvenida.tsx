import { useEffect, useRef } from "react";
import { useReplaceAllMutation } from "../data/ledgerApi";
import { today } from "../domain/dates";
import { demoLedger, emptyLedger } from "../domain/seed";

/** Primera vez: empezar con la app vacía o explorarla con datos de ejemplo. */
export function Bienvenida({ onDone, onCuenta }: { onDone: () => void; onCuenta?: () => void }) {
  const [replace, state] = useReplaceAllMutation();
  const start = async (demo: boolean) => {
    await replace(demo ? demoLedger(today()) : emptyLedger());
    onDone();
  };

  // "Ver con datos de ejemplo" en la presentación abre app/#ejemplo: entra directo con el ejemplo.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || window.location.hash !== "#ejemplo") return;
    auto.current = true;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    void start(true);
  });
  return (
    <main className="welcome">
      <div className="welcome__inner">
        {/* La app vive en /app/ y la presentación en la raíz; en el archivo portátil no hay a dónde volver. */}
        {window.location.protocol !== "file:" && (
          <a className="welcome__back" href="../">
            ‹ Volver a la página de Cuadre
          </a>
        )}
        <p className="brand brand--big">
          <span className="brand__mark" aria-hidden="true" />
          cuadre
        </p>
        <h1>Cuánto te queda, en qué se te va y qué puedes ajustar.</h1>
        <p className="welcome__lead">
          Registra tus gastos en segundos, ponle límite a lo que más se te va y recibe avisos calculados con tu propio historial.
          {onCuenta ? " Sin cuenta, tus datos se quedan en este dispositivo." : " Tus datos se quedan en este dispositivo."}
        </p>
        <div className="welcome__actions">
          <button type="button" className="btn btn--primary btn--big" onClick={() => start(false)} disabled={state.isLoading}>
            Empezar
          </button>
          <button type="button" className="btn btn--big" onClick={() => start(true)} disabled={state.isLoading}>
            Ver con datos de ejemplo
          </button>
        </div>
        {onCuenta && (
          <p className="muted">
            ¿Quieres verlo en el celular y en el computador?{" "}
            <button type="button" className="link" onClick={onCuenta}>
              Crea una cuenta o entra
            </button>
          </p>
        )}
      </div>
    </main>
  );
}
