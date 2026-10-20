import { useDeferredValue, useMemo, useState } from "react";
import { useLedger, useMoney, useMonth } from "../app/hooks";
import { Icon } from "../components/Icon";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { useSheet } from "../components/sheet";
import { TxRow } from "../components/TxRow";
import { dayLabel, monthLabel } from "../domain/dates";
import { inMonth, totals } from "../domain/summary";
import type { Transaction } from "../domain/types";

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function Movimientos() {
  const { ledger } = useLedger();
  const [month] = useMonth();
  const money = useMoney();
  const { open } = useSheet();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const deferred = useDeferredValue(query);

  const byId = useMemo(() => new Map(ledger.categories.map((c) => [c.id, c])), [ledger.categories]);
  const accounts = useMemo(() => new Map(ledger.accounts.map((a) => [a.id, a])), [ledger.accounts]);
  const t = useMemo(() => totals(ledger, month), [ledger, month]);

  const list = useMemo(() => {
    const q = norm(deferred.trim());
    return inMonth(ledger.transactions, month)
      .filter((tx) => (!category || tx.categoryId === category) && (!account || tx.accountId === account))
      .filter((tx) => !q || norm(`${tx.note} ${byId.get(tx.categoryId)?.name ?? ""}`).includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [ledger.transactions, month, category, account, deferred, byId]);

  const days = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const tx of list) groups.set(tx.date, [...(groups.get(tx.date) ?? []), tx]);
    return [...groups.entries()];
  }, [list]);

  const filtered = !!(query || category || account);
  const filteredOut = list.filter((x) => x.kind === "gasto").reduce((s, x) => s + x.amount, 0);

  return (
    <div className="page">
      <div className="page__head">
        <MonthSwitcher />
      </div>
      <header className="title-row">
        <h1>Movimientos</h1>
        <p className="muted">
          {filtered ? (
            <>
              {list.length} {list.length === 1 ? "movimiento" : "movimientos"}, {money(filteredOut)} en gastos
            </>
          ) : (
            <>
              {t.count} en {monthLabel(month)}: entraron {money(t.income)}, salieron {money(t.expense)}
            </>
          )}
        </p>
      </header>

      <div className="filters">
        <label className="search">
          <Icon name="search" size={18} />
          <span className="sr-only">Buscar</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nota o categoría" />
        </label>
        <label className="sr-only" htmlFor="f-cat">
          Categoría
        </label>
        <select id="f-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {ledger.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-acc">
          Cuenta
        </label>
        <select id="f-acc" value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="">Todas las cuentas</option>
          {ledger.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {days.length ? (
        <div className="days">
          {days.map(([date, txs]) => {
            const out = txs.filter((x) => x.kind === "gasto").reduce((s, x) => s + x.amount, 0);
            return (
              <section key={date} className="day" aria-label={dayLabel(date)}>
                <h2 className="day__head">
                  <span>{dayLabel(date)}</span>
                  {out > 0 && <span className="day__total">−{money(out)}</span>}
                </h2>
                <ul className="txs">
                  {txs.map((tx) => (
                    <TxRow key={tx.id} tx={tx} category={byId.get(tx.categoryId)} account={accounts.get(tx.accountId)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <p>{filtered ? "Nada coincide con esos filtros." : `No hay movimientos en ${monthLabel(month)}.`}</p>
          {!filtered && (
            <button type="button" className="btn btn--primary" onClick={() => open()}>
              <Icon name="plus" size={18} /> Registrar el primero
            </button>
          )}
        </div>
      )}
    </div>
  );
}
