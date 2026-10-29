import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useLedger, useMoney, useMonth, useToday } from "../app/hooks";
import { Icon } from "../components/Icon";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { useDeleteBudgetMutation, useSaveBudgetMutation } from "../data/ledgerApi";
import { elapsedFraction, monthOf } from "../domain/dates";
import { cop, parseAmount } from "../domain/money";
import { categoryAverage, projectMonth, totals } from "../domain/summary";
import type { Category } from "../domain/types";

export function Presupuestos() {
  const { ledger } = useLedger();
  const [month] = useMonth();
  const money = useMoney();
  const todayISO = useToday();
  const isCurrent = month === monthOf(todayISO);
  const elapsed = elapsedFraction(month, todayISO);
  const t = useMemo(() => totals(ledger, month), [ledger, month]);
  const projection = useMemo(() => projectMonth(ledger, month, todayISO), [ledger, month, todayISO]);
  const budgets = new Map(ledger.budgets.map((b) => [b.categoryId, b.limit]));
  const spendCats = ledger.categories.filter((c) => c.kind === "gasto" && c.group !== "ahorro");
  const withBudget = spendCats.filter((c) => budgets.has(c.id));
  const without = spendCats.filter((c) => !budgets.has(c.id));
  const totalBudget = withBudget.reduce((s, c) => s + (budgets.get(c.id) ?? 0), 0);
  const totalSpent = withBudget.reduce((s, c) => s + (t.byCategory.get(c.id) ?? 0), 0);

  return (
    <div className="page page--narrow">
      <div className="page__head">
        <MonthSwitcher />
      </div>
      <header className="title-row">
        <h1>Presupuestos</h1>
        <p className="muted">
          {withBudget.length
            ? `Llevas ${money(totalSpent)} de ${money(totalBudget)} en las categorías con presupuesto.`
            : "Ponle un límite mensual a las categorías donde quieres gastar menos."}
        </p>
      </header>

      {withBudget.length === 0 ? (
        <Link to="/armar" className="guia">
          <span className="guia__icon" aria-hidden="true">
            <Icon name="target" size={22} />
          </span>
          <span>
            <strong>Arma tu presupuesto en tres pasos</strong>
            <small>Cuánto te entra, en qué se te va y cuánto para cada cosa.</small>
          </span>
          <Icon name="right" />
        </Link>
      ) : (
        <Link to="/armar" className="link guia__otra">
          Rehacerlo con la guía
        </Link>
      )}

      {withBudget.length > 0 && (
        <ul className="budgets">
          {withBudget.map((c) => (
            <BudgetRow
              key={c.id}
              category={c}
              limit={budgets.get(c.id)!}
              spent={t.byCategory.get(c.id) ?? 0}
              projected={isCurrent ? (projection.byCategory.get(c.id) ?? 0) : null}
              elapsed={isCurrent ? elapsed : null}
              money={money}
            />
          ))}
        </ul>
      )}

      {without.length > 0 && (
        <section className="panel" aria-labelledby="h-sin">
          <h2 id="h-sin" className="panel__title">
            Sin presupuesto
          </h2>
          <ul className="nobudget">
            {without.map((c) => (
              <NewBudget key={c.id} category={c} suggestion={categoryAverage(ledger, c.id, month)} spent={t.byCategory.get(c.id) ?? 0} money={money} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

interface RowProps {
  category: Category;
  limit: number;
  spent: number;
  projected: number | null;
  elapsed: number | null;
  money: (n: number) => string;
}

function BudgetRow({ category, limit, spent, projected, elapsed, money }: RowProps) {
  const [save] = useSaveBudgetMutation();
  const [remove] = useDeleteBudgetMutation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(limit));
  const pct = Math.min(1, spent / limit);
  const over = spent > limit;
  const willOver = !over && projected !== null && projected > limit * 1.05;
  const left = limit - spent;

  return (
    <li className="budget">
      <div className="budget__top">
        <span className={`bars__icon cat--c${category.color}`}>
          <Icon name={category.icon} size={16} />
        </span>
        <span className="budget__name">{category.name}</span>
        {editing ? (
          <form
            className="budget__edit"
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseAmount(value);
              if (n && n > 0) save({ categoryId: category.id, limit: n });
              setEditing(false);
            }}
          >
            <label className="sr-only" htmlFor={`b-${category.id}`}>
              Presupuesto de {category.name}
            </label>
            <input id={`b-${category.id}`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
            <button type="submit" className="btn btn--small">
              Guardar
            </button>
            <button type="button" className="btn btn--small btn--quiet" onClick={() => remove(category.id)}>
              Quitar
            </button>
          </form>
        ) : (
          <button type="button" className="budget__amount" onClick={() => setEditing(true)} aria-label={`Cambiar presupuesto de ${category.name}, ${cop(limit)}`}>
            {money(spent)} <span className="muted">de {money(limit)}</span>
          </button>
        )}
      </div>
      <div className="budget__track">
        <span className={`budget__fill ${over ? "is-over" : willOver ? "is-warn" : ""}`} style={{ width: `${pct * 100}%` }} />
        {elapsed !== null && <span className="pace__today" style={{ left: `${elapsed * 100}%` }} aria-hidden="true" />}
      </div>
      <p className={`budget__note ${over ? "is-over" : willOver ? "is-warn" : ""}`}>
        {over
          ? `Te pasaste ${money(-left)}.`
          : willOver
            ? `Te quedan ${money(left)}. A este ritmo cierras en ${money(Math.round(projected! / 1000) * 1000)}.`
            : `Te quedan ${money(left)}.`}
      </p>
    </li>
  );
}

function NewBudget({ category, suggestion, spent, money }: { category: Category; suggestion: number | null; spent: number; money: (n: number) => string }) {
  const [save] = useSaveBudgetMutation();
  const [value, setValue] = useState("");
  const suggested = suggestion ? Math.ceil(suggestion / 10_000) * 10_000 : null;
  return (
    <li className="nobudget__row">
      <span className={`bars__icon cat--c${category.color}`}>
        <Icon name={category.icon} size={16} />
      </span>
      <span className="nobudget__name">
        {category.name}
        <span className="muted small">{spent ? `, ${money(spent)} este mes` : ""}</span>
      </span>
      <form
        className="nobudget__form"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseAmount(value || String(suggested ?? ""));
          if (n && n > 0) save({ categoryId: category.id, limit: n });
        }}
      >
        <label className="sr-only" htmlFor={`nb-${category.id}`}>
          Presupuesto para {category.name}
        </label>
        <input id={`nb-${category.id}`} inputMode="decimal" placeholder={suggested ? cop(suggested) : "Límite"} value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="btn btn--small">
          Poner
        </button>
      </form>
    </li>
  );
}
