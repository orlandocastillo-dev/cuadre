import { useRef, useState } from "react";
import { useAppDispatch, useAppSelector, useLedger } from "../app/hooks";
import { currentRepository, useReplaceAllMutation } from "../data/ledgerApi";
import { today } from "../domain/dates";
import { demoLedger, emptyLedger } from "../domain/seed";
import type { Ledger } from "../domain/types";
import { prefsChanged } from "../features/prefs";
import { TuCuenta } from "./TuCuenta";

export function Ajustes() {
  const dispatch = useAppDispatch();
  const prefs = useAppSelector((s) => s.prefs);
  const { ledger } = useLedger();
  const [replace] = useReplaceAllMutation();
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cuadre-respaldo-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as Partial<Ledger>;
      if (!Array.isArray(data.transactions)) throw new Error();
      await replace({ ...emptyLedger(), ...data });
      setMessage(`Se restauró el respaldo con ${data.transactions.length} movimientos.`);
    } catch {
      setMessage("Ese archivo no es un respaldo de Cuadre.");
    }
  };

  return (
    <div className="page page--narrow">
      <header className="title-row">
        <h1>Ajustes</h1>
      </header>

      <TuCuenta />

      <section className="settings">
        <div className="setting">
          <div>
            <p className="setting__title">Tema</p>
            <p className="muted small">El oscuro descansa la vista de noche.</p>
          </div>
          <div className="seg" role="group" aria-label="Tema">
            {(["auto", "claro", "oscuro"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={prefs.theme === t} onClick={() => dispatch(prefsChanged({ theme: t }))}>
                {t === "auto" ? "Automático" : t === "claro" ? "Claro" : "Oscuro"}
              </button>
            ))}
          </div>
        </div>

        <label className="setting">
          <span>
            <span className="setting__title">Ocultar montos</span>
            <span className="muted small">Para abrir la app en público sin que se vean tus cifras.</span>
          </span>
          <input type="checkbox" className="switch" checked={prefs.hideAmounts} onChange={(e) => dispatch(prefsChanged({ hideAmounts: e.target.checked }))} />
        </label>

        <div className="setting">
          <div>
            <p className="setting__title">Dónde están tus datos</p>
            <p className="muted small">
              {currentRepository()?.kind === "remoto"
                ? "En tu cuenta. Los ves igual en cualquier dispositivo donde entres."
                : "En este navegador. Descarga un respaldo de vez en cuando, o si vas a cambiar de celular."}
            </p>
          </div>
        </div>

        <div className="setting">
          <div>
            <p className="setting__title">Respaldo</p>
            <p className="muted small">{ledger.transactions.length} movimientos, {ledger.goals.length} metas y {ledger.budgets.length} presupuestos.</p>
          </div>
          <div className="setting__actions">
            <button type="button" className="btn btn--small" onClick={exportData}>
              Descargar
            </button>
            <button type="button" className="btn btn--small" onClick={() => file.current?.click()}>
              Restaurar
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </div>
        </div>

        <div className="setting">
          <div>
            <p className="setting__title">Empezar de nuevo</p>
            <p className="muted small">
              {currentRepository()?.kind === "remoto"
                ? "Borra todos los movimientos, metas y presupuestos de tu cuenta, en todos tus dispositivos."
                : "Borra todos los movimientos, metas y presupuestos de este dispositivo."}
            </p>
          </div>
          <div className="setting__actions">
            <button
              type="button"
              className="btn btn--small"
              onClick={async () => {
                await replace(demoLedger(today()));
                setMessage("Se cargaron datos de ejemplo.");
              }}
            >
              Datos de ejemplo
            </button>
            {confirmReset ? (
              <button
                type="button"
                className="btn btn--small btn--danger"
                onClick={async () => {
                  await replace(emptyLedger());
                  setConfirmReset(false);
                  setMessage("Se borraron todos los datos.");
                }}
              >
                Sí, borrar todo
              </button>
            ) : (
              <button type="button" className="btn btn--small btn--quiet" onClick={() => setConfirmReset(true)}>
                Borrar todo
              </button>
            )}
          </div>
        </div>
      </section>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
