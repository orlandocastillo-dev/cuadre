import { addMonths, dayOf, daysInMonth, elapsedFraction, monthOf } from "./dates";
import { findRecurring, merchantKey } from "./recurring";
import type { Category, Ledger, Transaction } from "./types";

export interface MonthTotals {
  month: string;
  income: number;
  /** Todo lo que salió, incluido lo que se apartó para ahorro. */
  expense: number;
  /** Lo que se fue en consumo: gastos sin contar el ahorro. */
  spending: number;
  saved: number;
  balance: number;
  byCategory: Map<string, number>;
  count: number;
}

export function inMonth(txs: Transaction[], month: string): Transaction[] {
  return txs.filter((t) => monthOf(t.date) === month);
}

export function totals(ledger: Pick<Ledger, "transactions" | "categories">, month: string): MonthTotals {
  const groupOf = new Map(ledger.categories.map((c) => [c.id, c.group]));
  const byCategory = new Map<string, number>();
  let income = 0;
  let expense = 0;
  let saved = 0;
  const txs = inMonth(ledger.transactions, month);
  for (const t of txs) {
    if (t.kind === "ingreso") {
      income += t.amount;
      continue;
    }
    expense += t.amount;
    if (groupOf.get(t.categoryId) === "ahorro") saved += t.amount;
    byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  }
  return { month, income, expense, spending: expense - saved, saved, balance: income - expense, byCategory, count: txs.length };
}

/** Gastos por categoría, de mayor a menor, con su categoría. */
export function topCategories(t: MonthTotals, categories: Category[]): { category: Category; amount: number }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return [...t.byCategory.entries()]
    .map(([id, amount]) => ({ category: byId.get(id), amount }))
    .filter((x): x is { category: Category; amount: number } => !!x.category && x.category.group !== "ahorro")
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Promedio mensual de una categoría en los meses anteriores con movimientos (hasta `months`).
 * Devuelve null si no hay historial suficiente para comparar.
 */
export function categoryAverage(ledger: Pick<Ledger, "transactions">, categoryId: string, month: string, months = 3): number | null {
  const firstMonth = ledger.transactions.reduce((min, t) => (monthOf(t.date) < min ? monthOf(t.date) : min), month);
  const values: number[] = [];
  for (let i = 1; i <= months; i++) {
    const m = addMonths(month, -i);
    if (m < firstMonth) break;
    values.push(inMonth(ledger.transactions, m).filter((t) => t.kind === "gasto" && t.categoryId === categoryId).reduce((s, t) => s + t.amount, 0));
  }
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Proyección a fin de mes al ritmo actual. En un mes cerrado es el valor real. */
export function projectToMonthEnd(amount: number, month: string, todayISO: string): number {
  const f = elapsedFraction(month, todayISO);
  if (f >= 1 || f <= 0) return amount;
  return amount / f;
}

/** Cuánto se puede gastar por día en lo que queda del mes sin pasarse. */
export function dailyAllowance(remaining: number, month: string, todayISO: string): number | null {
  if (monthOf(todayISO) !== month) return null;
  const left = daysInMonth(month) - Number(todayISO.slice(8, 10)) + 1;
  return left > 0 ? Math.max(0, remaining) / left : null;
}

/** Totales de los últimos `n` meses terminando en `month`, del más viejo al más nuevo. */
export function history(ledger: Pick<Ledger, "transactions" | "categories">, month: string, n = 6): MonthTotals[] {
  return Array.from({ length: n }, (_, i) => totals(ledger, addMonths(month, i - n + 1)));
}

export interface Projection {
  /** Consumo estimado al cierre del mes (sin contar el ahorro). */
  spending: number;
  byCategory: Map<string, number>;
}

/**
 * Cómo cerraría el mes al ritmo actual. Los pagos fijos (arriendo, servicios, suscripciones) no se
 * multiplican: cuentan una vez, y si todavía no se han cobrado este mes se suman como pendientes.
 * Solo el gasto variable se proyecta según los días que han pasado.
 */
export function projectMonth(ledger: Pick<Ledger, "transactions" | "categories">, month: string, todayISO: string): Projection {
  const f = elapsedFraction(month, todayISO);
  const groupOf = new Map(ledger.categories.map((c) => [c.id, c.group]));
  const recurring = f < 1 ? findRecurring(ledger.transactions, month) : [];
  const fixedKeys = new Set(recurring.map((r) => r.key));
  const fixed = new Map<string, number>();
  const variable = new Map<string, number>();
  const seen = new Set<string>();
  for (const t of inMonth(ledger.transactions, month)) {
    if (t.kind !== "gasto" || groupOf.get(t.categoryId) === "ahorro") continue;
    const key = merchantKey(t.note);
    const target = fixedKeys.has(key) ? fixed : variable;
    if (fixedKeys.has(key)) seen.add(key);
    target.set(t.categoryId, (target.get(t.categoryId) ?? 0) + t.amount);
  }
  if (f > 0 && f < 1) {
    for (const r of recurring) {
      if (seen.has(r.key) || groupOf.get(r.categoryId) === "ahorro") continue;
      // Solo lo que normalmente se cobra más adelante en el mes.
      if (dayOf(r.lastDate) > dayOf(todayISO)) fixed.set(r.categoryId, (fixed.get(r.categoryId) ?? 0) + r.monthly);
    }
  }
  const byCategory = new Map<string, number>();
  for (const id of new Set([...fixed.keys(), ...variable.keys()])) {
    const v = variable.get(id) ?? 0;
    byCategory.set(id, (fixed.get(id) ?? 0) + (f > 0 && f < 1 ? v / f : v));
  }
  let spending = 0;
  for (const v of byCategory.values()) spending += v;
  return { spending, byCategory };
}

/** En cuántos de los meses anteriores hubo gasto en la categoría. */
export function monthsWithSpending(ledger: Pick<Ledger, "transactions">, categoryId: string, month: string, months = 3): number {
  let n = 0;
  for (let i = 1; i <= months; i++) {
    const m = addMonths(month, -i);
    if (ledger.transactions.some((t) => t.kind === "gasto" && t.categoryId === categoryId && monthOf(t.date) === m)) n++;
  }
  return n;
}
