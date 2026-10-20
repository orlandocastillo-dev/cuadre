import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLedger, useMoney } from "../app/hooks";
import { Icon } from "../components/Icon";
import { useAddTransactionsMutation, useSaveRuleMutation } from "../data/ledgerApi";
import { importStatement, type ImportRow } from "../domain/csv";
import { dayLabel } from "../domain/dates";
import { merchantKey } from "../domain/recurring";
import type { Transaction } from "../domain/types";

const SAMPLE = `Fecha,Descripción,Valor
2026/10/18,COMPRA EN RAPPI COLOMBIA,-38.900
2026/10/17,PAGO PSE AIR-E ENERGIA,-142.300
2026/10/16,COMPRA OLIMPICA BARRANQUILLA,-186.450
2026/10/15,TRANSF NEQUI JUAN PEREZ,-50.000
2026/10/15,NETFLIX.COM,-26.900
2026/10/01,PAGO DE NOMINA EMPRESA SAS,3.300.000`;

export function Importar() {
  const { ledger } = useLedger();
  const money = useMoney();
  const navigate = useNavigate();
  const [add, adding] = useAddTransactionsMutation();
  const [saveRule] = useSaveRuleMutation();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<(ImportRow & { keep: boolean; duplicate: boolean })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState("bancolombia");
  const [done, setDone] = useState<number | null>(null);

  const incomeIds = useMemo(() => new Set(ledger.categories.filter((c) => c.kind === "ingreso").map((c) => c.id)), [ledger.categories]);

  const read = (content: string) => {
    setDone(null);
    const result = importStatement(content, ledger.rules, incomeIds);
    if (result.error) {
      setError(result.error);
      setRows(null);
      return;
    }
    setError(null);
    // Si ya existe un movimiento igual (fecha, valor y descripción), seguramente ya se importó antes.
    const existing = new Set(ledger.transactions.map((t) => `${t.date}|${t.amount}|${merchantKey(t.note)}`));
    setRows(result.rows.map((r) => {
      const duplicate = existing.has(`${r.date}|${r.amount}|${merchantKey(r.description)}`);
      return { ...r, keep: !duplicate, duplicate };
    }));
  };

  const confirm = async () => {
    if (!rows) return;
    const now = new Date().toISOString();
    const txs: Transaction[] = rows
      .filter((r) => r.keep)
      .map((r, i) => ({
        id: `imp-${Date.now().toString(36)}-${i}`,
        kind: r.kind,
        amount: r.amount,
        categoryId: r.categoryId,
        accountId: account,
        date: r.date,
        note: tidy(r.description),
        createdAt: now,
      }));
    await add(txs);
    setDone(txs.length);
    setRows(null);
    setText("");
  };

  const categoriesFor = (kind: ImportRow["kind"]) => ledger.categories.filter((c) => c.kind === kind);

  return (
    <div className="page page--narrow">
      <header className="title-row">
        <h1>Importar extracto</h1>
        <p className="muted">
          Descarga el extracto de tu banco en CSV (Bancolombia, Nequi, Davivienda y otros) y súbelo aquí. Cuadre reconoce las columnas y
          clasifica cada movimiento; tú revisas antes de guardar.
        </p>
      </header>

      {done !== null && (
        <div className="notice" role="status">
          <Icon name="check" size={18} />
          <p>
            Se importaron {done} movimientos.{" "}
            <button type="button" className="link" onClick={() => navigate("/movimientos")}>
              Verlos
            </button>
          </p>
        </div>
      )}

      {!rows && (
        <section className="panel form">
          <label className="drop">
            <Icon name="upload" size={22} />
            <span>
              <strong>Elegir archivo CSV</strong>
              <span className="muted"> o arrástralo aquí</span>
            </span>
            <input
              type="file"
              accept=".csv,text/csv,.txt"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) read(await f.text());
              }}
            />
          </label>
          <label className="field">
            <span className="field__label">O pega el contenido</span>
            <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Fecha,Descripción,Valor" spellCheck={false} />
          </label>
          <div className="form__actions">
            <button type="button" className="btn btn--quiet" onClick={() => setText(SAMPLE)}>
              Usar un ejemplo
            </button>
            <button type="button" className="btn btn--primary" disabled={!text.trim()} onClick={() => read(text)}>
              Revisar movimientos
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}

      {rows && (
        <section className="panel" aria-labelledby="h-rev">
          <div className="panel__head">
            <h2 id="h-rev">Revisa antes de guardar</h2>
            <label className="inline-select">
              <span className="muted small">Cuenta</span>
              <select value={account} onChange={(e) => setAccount(e.target.value)}>
                {ledger.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">
            {rows.filter((r) => r.keep).length} de {rows.length} seleccionados.
            {rows.some((r) => r.duplicate) && " Los que ya tenías quedaron sin marcar."} Si cambias una categoría, Cuadre la recuerda para la próxima vez.
          </p>
          <ul className="review">
            {rows.map((r, i) => (
              <li key={i} className={`review__row ${r.keep ? "" : "is-off"}`}>
                <input
                  type="checkbox"
                  checked={r.keep}
                  aria-label={`Importar ${r.description}`}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                />
                <div className="review__main">
                  <span className="review__desc">{tidy(r.description)}</span>
                  <span className="muted small">
                    {dayLabel(r.date)}
                    {r.duplicate ? ", ya registrado" : ""}
                  </span>
                </div>
                <select
                  aria-label={`Categoría de ${r.description}`}
                  value={r.categoryId}
                  onChange={(e) => {
                    const categoryId = e.target.value;
                    setRows(rows.map((x, j) => (j === i ? { ...x, categoryId } : x)));
                    const key = merchantKey(r.description);
                    if (key.length >= 3) saveRule({ pattern: key, categoryId });
                  }}
                >
                  {categoriesFor(r.kind).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className={`review__amount ${r.kind === "ingreso" ? "is-in" : ""}`}>
                  {r.kind === "ingreso" ? "+" : "−"}
                  {money(r.amount)}
                </span>
              </li>
            ))}
          </ul>
          <div className="form__actions">
            <button type="button" className="btn btn--quiet" onClick={() => setRows(null)}>
              Cancelar
            </button>
            <button type="button" className="btn btn--primary" onClick={confirm} disabled={adding.isLoading || !rows.some((r) => r.keep)}>
              Importar {rows.filter((r) => r.keep).length} movimientos
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** "COMPRA EN RAPPI COLOMBIA" → "Compra en Rappi Colombia": las mayúsculas del banco se leen mal. */
function tidy(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}
