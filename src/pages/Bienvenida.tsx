import { useReplaceAllMutation } from "../data/ledgerApi";
import { today } from "../domain/dates";
import { demoLedger, emptyLedger } from "../domain/seed";

/** Primera vez: empezar con la app vacía o explorarla con datos de ejemplo. */
export function Bienvenida({ onDone }: { onDone: () => void }) {
  const [replace, state] = useReplaceAllMutation();
  const start = async (demo: boolean) => {
    await replace(demo ? demoLedger(today()) : emptyLedger());
    onDone();
  };
  return (
    <main className="welcome">
      <div className="welcome__inner">
        <p className="brand brand--big">
          <span className="brand__mark" aria-hidden="true" />
          cuadre
        </p>
        <h1>Sabe cuánto te queda, en qué se te va y qué puedes ajustar.</h1>
        <p className="welcome__lead">
          Registra tus gastos en segundos, ponle límite a lo que más se te va y recibe avisos calculados con tu propio historial. Tus datos se
          quedan en este dispositivo.
        </p>
        <div className="welcome__actions">
          <button type="button" className="btn btn--primary btn--big" onClick={() => start(false)} disabled={state.isLoading}>
            Empezar
          </button>
          <button type="button" className="btn btn--big" onClick={() => start(true)} disabled={state.isLoading}>
            Ver con datos de ejemplo
          </button>
        </div>
      </div>
    </main>
  );
}
