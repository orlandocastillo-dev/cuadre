import { addMonths, monthOf } from "./dates";
import type { Transaction } from "./types";

export interface Recurring {
  /** Nombre normalizado del comercio o la nota ("netflix"). */
  key: string;
  label: string;
  categoryId: string;
  /** Valor típico por mes. */
  monthly: number;
  months: number;
  lastDate: string;
}

/** "COMPRA NETFLIX.COM 8234 BOG" → "netflix": quita números de referencia y ruido para agrupar. */
export function merchantKey(note: string): string {
  return note
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/\b(compra|pago|pse|debito|credito|tarjeta|cop|col|bog|baq|med|co|com|www|en|de|por|sas)\b/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

// Cobros que se repiten: el mismo comercio en al menos 2 meses seguidos con un valor parecido (±15 %), y que siguen vivos (último cobro en el mes actual o el anterior)
export function findRecurring(txs: Transaction[], currentMonth: string): Recurring[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.kind !== "gasto" || !t.note.trim()) continue;
    const key = merchantKey(t.note);
    if (key.length < 3) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const result: Recurring[] = [];
  for (const [key, list] of groups) {
    const byMonth = new Map<string, number>();
    for (const t of list) byMonth.set(monthOf(t.date), (byMonth.get(monthOf(t.date)) ?? 0) + t.amount);
    // Varias compras al mes en el mismo sitio (el D1 cada semana) no son una suscripción.
    if ([...byMonth.keys()].some((m) => list.filter((t) => monthOf(t.date) === m).length > 1)) continue;
    const months = [...byMonth.keys()].sort();
    if (months.length < 2) continue;
    const last = months[months.length - 1];
    if (last < addMonths(currentMonth, -1)) continue;
    let consecutive = true;
    for (let i = 1; i < months.length; i++) if (addMonths(months[i - 1], 1) !== months[i]) consecutive = false;
    if (!consecutive) continue;
    const values = months.map((m) => byMonth.get(m)!);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (values.some((v) => Math.abs(v - avg) / avg > 0.15)) continue;
    const latest = list.reduce((a, b) => (a.date > b.date ? a : b));
    result.push({ key, label: latest.note, categoryId: latest.categoryId, monthly: Math.round(values[values.length - 1]), months: months.length, lastDate: latest.date });
  }
  return result.sort((a, b) => b.monthly - a.monthly);
}
