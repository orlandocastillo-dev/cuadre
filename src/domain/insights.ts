import { addMonths, elapsedFraction, longMonth, monthOf, monthsBetween } from "./dates";
import { cop, percent } from "./money";
import { findRecurring } from "./recurring";
import { categoryAverage, inMonth, monthsWithSpending, projectMonth, projectToMonthEnd, totals } from "./summary";
import type { Category, Ledger } from "./types";

export type Tone = "alerta" | "aviso" | "dato" | "bien";

export interface Insight {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  categoryId?: string;
}

const ORDER: Record<Tone, number> = { alerta: 0, aviso: 1, dato: 2, bien: 3 };

/** Diferencias menores a esto no merecen un aviso: nadie quiere una alerta por $3.000. */
const MIN_DIFF = 30_000;

// Recomendaciones para un mes, calculadas solo con los datos de la persona
export function insights(ledger: Ledger, month: string, todayISO: string): Insight[] {
  const out: Insight[] = [];
  const t = totals(ledger, month);
  const cats = new Map(ledger.categories.map((c) => [c.id, c]));
  const name = (id: string) => cats.get(id)?.name.toLowerCase() ?? "otros";
  const elapsed = elapsedFraction(month, todayISO);
  const isCurrent = monthOf(todayISO) === month;
  const budgeted = new Set<string>();
  const projection = projectMonth(ledger, month, todayISO);

  // 1. Presupuestos: pasados o a punto de pasarse al ritmo actual.
  for (const b of ledger.budgets) {
    const spent = t.byCategory.get(b.categoryId) ?? 0;
    const cat = cats.get(b.categoryId);
    if (!cat || b.limit <= 0) continue;
    if (spent > b.limit) {
      budgeted.add(b.categoryId);
      out.push({
        id: `presupuesto-${b.categoryId}`,
        tone: "alerta",
        categoryId: b.categoryId,
        title: `Te pasaste en ${name(b.categoryId)}`,
        detail: `Llevas ${cop(spent)} de ${cop(b.limit)}: ${cop(spent - b.limit)} por encima del presupuesto${isCurrent ? " y aún queda mes" : ""}.`,
      });
      continue;
    }
    if (isCurrent && elapsed > 0.15) {
      const projected = projection.byCategory.get(b.categoryId) ?? spent;
      if (projected > b.limit * 1.05 && projected - b.limit >= MIN_DIFF / 2) {
        budgeted.add(b.categoryId);
        out.push({
          id: `ritmo-${b.categoryId}`,
          tone: "aviso",
          categoryId: b.categoryId,
          title: `A este ritmo te pasas en ${name(b.categoryId)}`,
          detail: `Vas en ${cop(spent)} y terminarías el mes cerca de ${cop(round(projected))}, ${cop(round(projected - b.limit))} más de lo que presupuestaste. Te quedan ${cop(b.limit - spent)} para el resto del mes.`,
        });
      }
    }
  }

  // 2. Comparación con su propio promedio: cómo cerraría el mes frente a un mes normal.
  for (const cat of ledger.categories) {
    if (cat.kind !== "gasto" || cat.group === "ahorro" || cat.group === "aporte" || budgeted.has(cat.id)) continue;
    const avg = categoryAverage(ledger, cat.id, month);
    // Una compra suelta (unos tenis en septiembre) no es un hábito con el cual comparar.
    if (avg === null || avg < 30_000 || monthsWithSpending(ledger, cat.id, month) < 2) continue;
    const spent = t.byCategory.get(cat.id) ?? 0;
    const projected = projection.byCategory.get(cat.id) ?? 0;
    const ratio = projected / avg;
    if (ratio >= 1.3 && projected - avg >= MIN_DIFF) {
      out.push({
        id: `promedio-${cat.id}`,
        tone: "aviso",
        categoryId: cat.id,
        title: `Estás gastando más en ${name(cat.id)}`,
        detail: isCurrent
          ? `Llevas ${cop(spent)}. A este ritmo cerrarías el mes en ${cop(round(projected))}, ${percent(projected - avg, avg)} % más que tu promedio (${cop(round(avg))}).`
          : `Fueron ${cop(spent)}, ${percent(projected - avg, avg)} % más que tu promedio de los meses anteriores (${cop(round(avg))}).`,
      });
    } else if (ratio <= 0.7 && avg - projected >= MIN_DIFF && (elapsed > 0.4 || !isCurrent)) {
      out.push({
        id: `menos-${cat.id}`,
        tone: "bien",
        categoryId: cat.id,
        title: `Vas por debajo en ${name(cat.id)}`,
        detail: `${isCurrent ? "A este ritmo cerrarías" : "Cerraste"} en ${cop(round(projected))}, ${percent(avg - projected, avg)} % menos que tu promedio (${cop(round(avg))}).`,
      });
    }
  }

  // 3. Gastos hormiga: muchos gastos pequeños en gustos.
  const small = new Map<string, { count: number; sum: number }>();
  for (const tx of inMonth(ledger.transactions, month)) {
    if (tx.kind !== "gasto" || tx.amount >= 25_000 || cats.get(tx.categoryId)?.group !== "gusto") continue;
    const s = small.get(tx.categoryId) ?? { count: 0, sum: 0 };
    small.set(tx.categoryId, { count: s.count + 1, sum: s.sum + tx.amount });
  }
  for (const [id, s] of small) {
    if (s.count < 8) continue;
    const yearly = (isCurrent ? projectToMonthEnd(s.sum, month, todayISO) : s.sum) * 12;
    out.push({
      id: `hormiga-${id}`,
      tone: "dato",
      categoryId: id,
      title: `${s.count} gastos pequeños en ${name(id)}`,
      detail: `Suman ${cop(s.sum)} este mes. A ese ritmo serían unos ${cop(Math.round(yearly / 10_000) * 10_000)} al año.`,
    });
  }

  // 4. Cobros que se repiten cada mes.
  const recurring = findRecurring(ledger.transactions, month).filter((r) => r.categoryId === "suscripciones");
  if (recurring.length >= 2) {
    const monthly = recurring.reduce((s, r) => s + r.monthly, 0);
    out.push({
      id: "suscripciones",
      tone: "dato",
      categoryId: "suscripciones",
      title: `Pagas ${recurring.length} suscripciones cada mes`,
      detail: `${recurring.map((r) => r.label).join(", ")}: ${cop(monthly)} al mes, ${cop(monthly * 12)} al año. Revisa si todavía las usas todas.`,
    });
  }

  // 5. Ahorro del mes.
  if (t.income > 0 && (elapsed >= 0.5 || !isCurrent)) {
    const spending = isCurrent ? projection.spending : t.spending;
    const rate = (t.income - spending) / t.income;
    const pct = Math.round(rate * 100);
    if (rate < 0) {
      out.push({ id: "ahorro", tone: "alerta", title: "Estás gastando más de lo que entra", detail: `${isCurrent ? "A este ritmo terminarías" : "Terminaste"} el mes con ${cop(round(t.income - spending))}. Revisa los gastos en gustos primero.` });
    } else if (rate < 0.1) {
      out.push({ id: "ahorro", tone: "aviso", title: `${isCurrent ? "Te quedaría" : "Te quedó"} el ${pct} % de lo que ganaste`, detail: "Una referencia común es apartar al menos el 10 % de los ingresos apenas llegan, antes de gastar." });
    } else if (rate >= 0.2) {
      out.push({ id: "ahorro", tone: "bien", title: `${isCurrent ? "Vas a guardar" : "Guardaste"} el ${pct} % de tus ingresos`, detail: `Son ${cop(round(t.income - spending))} entre lo que apartaste y lo que no gastaste.` });
    }
  }

  // 6. Metas: ¿alcanza el ritmo de ahorro para llegar a tiempo?
  const avgSaved = averageSaved(ledger, month);
  for (const g of ledger.goals) {
    const left = g.target - g.saved;
    if (left <= 0) {
      out.push({ id: `meta-${g.id}`, tone: "bien", title: `Cumpliste la meta ${g.name}`, detail: `Reuniste ${cop(g.saved)}.` });
      continue;
    }
    if (!g.deadline) continue;
    const monthsLeft = Math.max(1, monthsBetween(month, monthOf(g.deadline)) - (isCurrent ? 0 : 1));
    const needed = Math.ceil(left / monthsLeft / 1_000) * 1_000;
    if (avgSaved > 0 && avgSaved >= needed) {
      out.push({ id: `meta-${g.id}`, tone: "bien", title: `Vas bien con ${g.name}`, detail: `Necesitas ${cop(Math.round(needed))} al mes y vienes apartando ${cop(Math.round(avgSaved))}.` });
    } else {
      out.push({
        id: `meta-${g.id}`,
        tone: "aviso",
        title: `Para ${g.name} necesitas ${cop(Math.round(needed))} al mes`,
        detail: `Te faltan ${cop(left)} y la fecha es ${longMonth(monthOf(g.deadline))}. ${avgSaved > 0 ? `Vienes apartando ${cop(Math.round(avgSaved))} al mes.` : "Aún no has registrado ahorros."}`,
      });
    }
  }

  return out.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

function round(n: number): number {
  return Math.round(n / 1_000) * 1_000;
}

/** Promedio mensual apartado en la categoría de ahorro, en los 3 meses anteriores. */
export function averageSaved(ledger: Ledger, month: string): number {
  const months = [1, 2, 3].map((i) => addMonths(month, -i));
  const values = months.map((m) => totals(ledger, m).saved).filter((v) => v > 0);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Reparto del mes entre necesidades, gustos y ahorro, para compararlo con 50/30/20. */
export function split(ledger: Ledger, month: string): { necesidad: number; gusto: number; ahorro: number; aporte: number } {
  const t = totals(ledger, month);
  const groups = { necesidad: 0, gusto: 0, ahorro: 0, aporte: 0 };
  const byId = new Map<string, Category>(ledger.categories.map((c) => [c.id, c]));
  for (const [id, amount] of t.byCategory) {
    const g = byId.get(id)?.group ?? "gusto";
    groups[g] += amount;
  }
  return groups;
}
