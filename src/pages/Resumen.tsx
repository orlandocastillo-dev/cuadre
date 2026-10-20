import { useMemo } from "react";
import { Link } from "react-router";
import { useLedger, useMoney, useMonth, useToday } from "../app/hooks";
import { Icon } from "../components/Icon";
import { Insights } from "../components/Insights";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { useSheet } from "../components/sheet";
import { TrendChart } from "../components/TrendChart";
import { TxRow } from "../components/TxRow";
import { dayOf, daysInMonth, elapsedFraction, monthLabel, monthOf } from "../domain/dates";
import { insights } from "../domain/insights";
import { percent } from "../domain/money";
import { dailyAllowance, history, inMonth, topCategories, totals } from "../domain/summary";

export function Resumen() {
  const { ledger, isLoading } = useLedger();
  const [month, setMonth] = useMonth();
  const money = useMoney();
  const { open } = useSheet();
  const todayISO = useToday();
  const isCurrent = month === monthOf(todayISO);

  const t = useMemo(() => totals(ledger, month), [ledger, month]);
  const tips = useMemo(() => insights(ledger, month, todayISO), [ledger, month, todayISO]);
  // Solo los meses desde que hay datos (mínimo 3), para no mostrar barras vacías.
  const trend = useMemo(() => {
    const all = history(ledger, month, 6);
    const first = all.findIndex((m) => m.count > 0);
    return all.slice(Math.max(0, Math.min(first < 0 ? 3 : first, 3)));
  }, [ledger, month]);
  const cats = useMemo(() => topCategories(t, ledger.categories), [t, ledger.categories]);
  const recent = useMemo(() => inMonth(ledger.transactions, month).slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [ledger.transactions, month]);

  if (isLoading) return <p className="muted">Cargando…</p>;

  const elapsed = elapsedFraction(month, todayISO);
  const spentShare = t.income > 0 ? Math.min(1.2, t.expense / t.income) : 0;
  const ahead = t.income > 0 && isCurrent && spentShare > elapsed + 0.05;
  const perDay = isCurrent ? dailyAllowance(t.balance, month, todayISO) : null;
  const budgets = new Map(ledger.budgets.map((b) => [b.categoryId, b.limit]));
  const scale = Math.max(1, ...cats.map((c) => Math.max(c.amount, budgets.get(c.category.id) ?? 0)));
  const byId = new Map(ledger.categories.map((c) => [c.id, c]));
  const accounts = new Map(ledger.accounts.map((a) => [a.id, a]));

  return (
    <div className="page">
      <div className="page__head">
        <MonthSwitcher />
      </div>

      <section className="hero" aria-labelledby="hero-label">
        <p id="hero-label" className="hero__label">
          {t.income > 0 ? (t.balance >= 0 ? (isCurrent ? "Te quedan" : "Te sobró") : isCurrent ? "Vas en rojo por" : "Gastaste de más") : "Llevas gastado"}
        </p>
        <p className={`hero__amount ${t.balance < 0 && t.income > 0 ? "is-over" : ""}`}>{money(t.income > 0 ? Math.abs(t.balance) : t.expense)}</p>
        <p className="hero__sub">
          {t.income > 0 ? (
            <>
              Entraron <strong>{money(t.income)}</strong> y salieron <strong>{money(t.expense)}</strong>
              {t.saved > 0 && <>, de los cuales {money(t.saved)} fueron a ahorro</>}.
            </>
          ) : (
            <>Registra tus ingresos de {monthLabel(month)} para ver cuánto te queda.</>
          )}
        </p>

        {t.income > 0 && (
          <div className="pace">
            <div className="pace__track" role="img" aria-label={`Has usado el ${percent(t.expense, t.income)} % de tus ingresos${isCurrent ? ` y va el ${Math.round(elapsed * 100)} % del mes` : ""}`}>
              <span className={`pace__fill ${ahead ? "is-ahead" : ""}`} style={{ width: `${Math.min(100, spentShare * 100)}%` }} />
              {isCurrent && <span className="pace__today" style={{ left: `${elapsed * 100}%` }} />}
            </div>
            <p className="pace__text">
              {isCurrent ? (
                <>
                  Día {dayOf(todayISO)} de {daysInMonth(month)}: has usado el <strong>{percent(t.expense, t.income)} %</strong> de lo que entró.{" "}
                  {ahead ? "Vas más rápido que el mes." : "Vas a buen ritmo."}
                  {perDay !== null && t.balance > 0 && <> Puedes gastar unos {money(Math.floor(perDay / 1000) * 1000)} diarios hasta fin de mes.</>}
                </>
              ) : (
                <>Usaste el {percent(t.expense, t.income)} % de lo que entró.</>
              )}
            </p>
          </div>
        )}
      </section>

      <div className="grid">
        <section className="panel" aria-labelledby="h-recos">
          <div className="panel__head">
            <h2 id="h-recos">Recomendaciones</h2>
          </div>
          <Insights items={tips} limit={5} />
          {tips.length > 5 && (
            <details className="more">
              <summary>Ver {tips.length - 5} más</summary>
              <Insights items={tips.slice(5)} />
            </details>
          )}
          <p className="fineprint">Calculadas con tus propios movimientos. No son asesoría financiera.</p>
        </section>

        <section className="panel" aria-labelledby="h-cats">
          <div className="panel__head">
            <h2 id="h-cats">En qué se fue</h2>
            <Link to={`/presupuestos${isCurrent ? "" : `?mes=${month}`}`} className="link">
              Presupuestos
            </Link>
          </div>
          {cats.length ? (
            <ul className="bars">
              {cats.slice(0, 8).map(({ category, amount }) => {
                const limit = budgets.get(category.id);
                const over = limit !== undefined && amount > limit;
                return (
                  <li key={category.id} className="bars__row">
                    <div className="bars__label">
                      <span className={`bars__icon cat--c${category.color}`}>
                        <Icon name={category.icon} size={16} />
                      </span>
                      <span className="bars__name">{category.name}</span>
                      <span className="bars__value">
                        {money(amount)}
                        {limit !== undefined && <span className="muted"> de {money(limit)}</span>}
                      </span>
                    </div>
                    <div className="bars__track">
                      <span className={`bars__fill ${over ? "is-over" : ""}`} style={{ width: `${(amount / scale) * 100}%` }} />
                      {limit !== undefined && <span className="bars__limit" style={{ left: `${(limit / scale) * 100}%` }} title={`Presupuesto: ${money(limit)}`} />}
                    </div>
                    {over && <span className="bars__flag">Te pasaste {money(amount - limit)}</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty">
              <p>Aún no hay gastos en {monthLabel(month)}.</p>
              <button type="button" className="btn" onClick={() => open()}>
                <Icon name="plus" size={18} /> Registrar un gasto
              </button>
            </div>
          )}
        </section>

        <section className="panel panel--wide" aria-labelledby="h-trend">
          <div className="panel__head">
            <h2 id="h-trend">{trend.length === 6 ? "Últimos 6 meses" : `Últimos ${trend.length} meses`}</h2>
          </div>
          <TrendChart data={trend} selected={month} onSelect={setMonth} />
        </section>

        <section className="panel panel--wide" aria-labelledby="h-recent">
          <div className="panel__head">
            <h2 id="h-recent">Movimientos recientes</h2>
            <Link to={`/movimientos${isCurrent ? "" : `?mes=${month}`}`} className="link">
              Ver todos
            </Link>
          </div>
          {recent.length ? (
            <ul className="txs">
              {recent.map((tx) => (
                <TxRow key={tx.id} tx={tx} category={byId.get(tx.categoryId)} account={accounts.get(tx.accountId)} />
              ))}
            </ul>
          ) : (
            <p className="muted">Sin movimientos este mes.</p>
          )}
        </section>
      </div>
    </div>
  );
}
