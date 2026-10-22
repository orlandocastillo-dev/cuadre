import { useState } from "react";
import type { Ledger } from "../domain/types";

// Primera vez que se entra con cuenta en un dispositivo que ya tenía datos sin cuenta
export function PasarDatos({ local, nombre, onPasar, onOmitir }: { local: Ledger; nombre: string; onPasar: () => Promise<string | null>; onOmitir: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = local.transactions.length;
  const esEjemplo = local.transactions.length > 0 && local.transactions.every((t) => t.id.startsWith("demo-"));

  return (
    <main className="welcome">
      <div className="welcome__inner">
        <p className="brand brand--big">
          <span className="brand__mark" aria-hidden="true" />
          cuadre
        </p>
        <h1 className="pasar__titulo">Hola, {nombre}. ¿Pasamos lo que tenías en este dispositivo?</h1>
        <p className="welcome__lead">
          {esEjemplo
            ? `Aquí están los datos de ejemplo (${n} movimientos). Lo normal es empezar tu cuenta en blanco.`
            : `Encontramos ${n} ${n === 1 ? "movimiento" : "movimientos"}, ${local.goals.length} ${local.goals.length === 1 ? "meta" : "metas"} y ${local.budgets.length} ${local.budgets.length === 1 ? "presupuesto" : "presupuestos"} guardados sin cuenta. Si los pasas, los verás en todos tus dispositivos.`}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="welcome__actions">
          <button
            type="button"
            className={`btn btn--big ${esEjemplo ? "" : "btn--primary"}`}
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              setError(await onPasar());
              setEnviando(false);
            }}
          >
            {enviando ? "Pasando…" : "Pasar a mi cuenta"}
          </button>
          <button type="button" className={`btn btn--big ${esEjemplo ? "btn--primary" : ""}`} disabled={enviando} onClick={onOmitir}>
            Empezar en blanco
          </button>
        </div>
        <p className="muted small">Lo de este dispositivo no se borra: sigue ahí si sales de la cuenta.</p>
      </div>
    </main>
  );
}
