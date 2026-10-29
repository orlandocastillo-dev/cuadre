import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLedger, useToday } from "../app/hooks";
import { Icon } from "../components/Icon";
import { useSaveBudgetMutation, useSaveTransactionMutation } from "../data/ledgerApi";
import { monthOf } from "../domain/dates";
import { cop, parseAmount } from "../domain/money";

// Lo que suele llevarse cada cosa del ingreso, para proponer un primer límite que luego se ajusta.
const SUGERIDO: Record<string, number> = {
  hogar: 0.3,
  mercado: 0.15,
  transporte: 0.08,
  salud: 0.04,
  educacion: 0.05,
  domicilios: 0.05,
  cafe: 0.02,
  suscripciones: 0.02,
  compras: 0.04,
  salidas: 0.04,
  iglesia: 0.05,
};
const DE_UNA = ["hogar", "mercado", "transporte", "domicilios", "cafe", "suscripciones"];

const redondear = (n: number) => Math.max(10000, Math.round(n / 10000) * 10000);
const conPuntos = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d ? Number(d).toLocaleString("es-CO") : "";
};

function nuevoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `t-${Date.now()}`;
}

/** Arma el presupuesto del mes en tres pasos: cuánto entra, en qué se va y cuánto para cada cosa. */
export function Armar() {
  const { ledger } = useLedger();
  const navigate = useNavigate();
  const hoy = useToday();
  const [saveBudget] = useSaveBudgetMutation();
  const [saveTx] = useSaveTransactionMutation();

  const yaEntro = useMemo(
    () => ledger.transactions.filter((t) => t.kind === "ingreso" && monthOf(t.date) === monthOf(hoy)).reduce((s, t) => s + t.amount, 0),
    [ledger.transactions, hoy],
  );
  const antes = new Map(ledger.budgets.map((b) => [b.categoryId, b.limit]));
  const opciones = ledger.categories.filter((c) => c.kind === "gasto" && c.group !== "ahorro" && c.id !== "otros");

  const [paso, setPaso] = useState(1);
  const [ingreso, setIngreso] = useState(yaEntro ? yaEntro.toLocaleString("es-CO") : "");
  const [anotar, setAnotar] = useState(yaEntro === 0);
  const [elegidas, setElegidas] = useState<string[]>(() => (antes.size ? [...antes.keys()] : DE_UNA.filter((id) => opciones.some((c) => c.id === id))));
  const [limites, setLimites] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monto = parseAmount(ingreso) ?? 0;
  const limiteDe = (id: string) => parseAmount(limites[id] ?? "") ?? 0;
  const total = elegidas.reduce((s, id) => s + limiteDe(id), 0);
  const sobra = monto - total;

  const irALimites = () => {
    // El primer límite sale del ingreso; si ya había presupuesto, se respeta.
    setLimites(Object.fromEntries(elegidas.map((id) => [id, (antes.get(id) ?? redondear(monto * (SUGERIDO[id] ?? 0.04))).toLocaleString("es-CO")])));
    setPaso(3);
  };

  const terminar = async () => {
    setGuardando(true);
    setError(null);
    try {
      if (anotar && monto > 0) {
        await saveTx({
          id: nuevoId(),
          kind: "ingreso",
          amount: monto,
          categoryId: "salario",
          accountId: ledger.accounts[0]?.id ?? "efectivo",
          date: hoy,
          note: "Ingreso del mes",
          createdAt: new Date().toISOString(),
        }).unwrap();
      }
      for (const id of elegidas) {
        const limit = limiteDe(id);
        if (limit > 0) await saveBudget({ categoryId: id, limit }).unwrap();
      }
      navigate("/presupuestos", { replace: true });
    } catch {
      setError("No se pudo guardar. Revisa la conexión e inténtalo otra vez.");
      setGuardando(false);
    }
  };

  return (
    <div className="page page--narrow armar">
      <div className="armar__pasos" aria-label={`Paso ${paso} de 3`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= paso ? "is-on" : ""} />
        ))}
      </div>

      {paso === 1 && (
        <section className="armar__paso">
          <p className="armar__num">Paso 1 de 3</p>
          <h1>¿Cuánto te entra al mes?</h1>
          <p className="muted">Tu sueldo o lo que te llega normalmente. Con eso te proponemos cuánto darle a cada cosa.</p>
          <label className="armar__monto">
            <span aria-hidden="true">$</span>
            <input inputMode="numeric" autoComplete="off" placeholder="0" value={ingreso} onChange={(e) => setIngreso(conPuntos(e.target.value))} aria-label="Ingreso mensual" autoFocus />
          </label>
          {yaEntro === 0 && (
            <label className="armar__check">
              <input type="checkbox" checked={anotar} onChange={(e) => setAnotar(e.target.checked)} />
              Anotarlo como ingreso de este mes
            </label>
          )}
          <button type="button" className="btn btn--primary btn--big armar__seguir" disabled={monto <= 0} onClick={() => setPaso(2)}>
            Seguir
          </button>
        </section>
      )}

      {paso === 2 && (
        <section className="armar__paso">
          <p className="armar__num">Paso 2 de 3</p>
          <h1>¿En qué se te va la plata?</h1>
          <p className="muted">Toca las que quieras controlar. Las demás igual las puedes registrar.</p>
          <div className="armar__cats">
            {opciones.map((c) => {
              const on = elegidas.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`armar__cat cat--c${c.color}`}
                  aria-pressed={on}
                  onClick={() => setElegidas((l) => (on ? l.filter((x) => x !== c.id) : [...l, c.id]))}
                >
                  <span className="armar__cat-icon">
                    <Icon name={on ? "check" : c.icon} size={20} />
                  </span>
                  {c.name}
                </button>
              );
            })}
          </div>
          <div className="armar__nav">
            <button type="button" className="btn btn--big" onClick={() => setPaso(1)}>
              Atrás
            </button>
            <button type="button" className="btn btn--primary btn--big" disabled={!elegidas.length} onClick={irALimites}>
              Seguir con {elegidas.length}
            </button>
          </div>
        </section>
      )}

      {paso === 3 && (
        <section className="armar__paso">
          <p className="armar__num">Paso 3 de 3</p>
          <h1>Tu límite para cada una</h1>
          <p className="muted">Te propusimos un valor según lo que te entra. Cámbialo como te sirva.</p>
          <ul className="armar__limites">
            {elegidas.map((id) => {
              const c = opciones.find((x) => x.id === id);
              if (!c) return null;
              return (
                <li key={id}>
                  <span className={`armar__cat-icon cat--c${c.color}`}>
                    <Icon name={c.icon} size={18} />
                  </span>
                  <span className="armar__nombre">{c.name}</span>
                  <label className="armar__valor">
                    <span aria-hidden="true">$</span>
                    <input inputMode="numeric" value={limites[id] ?? ""} onChange={(e) => setLimites((l) => ({ ...l, [id]: conPuntos(e.target.value) }))} aria-label={`Límite para ${c.name}`} />
                  </label>
                </li>
              );
            })}
          </ul>
          <div className={`armar__cuenta ${sobra < 0 ? "is-over" : ""}`}>
            <div className="armar__barra" aria-hidden="true">
              <span style={{ width: `${Math.min(100, monto ? (total / monto) * 100 : 0)}%` }} />
            </div>
            <p>
              {sobra >= 0 ? (
                <>
                  Te quedan <strong>{cop(sobra)}</strong> para ahorrar o para lo demás.
                </>
              ) : (
                <>
                  Te pasas por <strong>{cop(-sobra)}</strong> de lo que te entra.
                </>
              )}
            </p>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="armar__nav">
            <button type="button" className="btn btn--big" onClick={() => setPaso(2)}>
              Atrás
            </button>
            <button type="button" className="btn btn--primary btn--big" disabled={guardando} onClick={() => void terminar()}>
              Guardar mi presupuesto
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
