import { addMonths, daysInMonth, monthOf } from "./dates";
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, DEFAULT_RULES } from "./defaults";
import type { Ledger, Transaction } from "./types";

/** Generador pseudoaleatorio con semilla: los datos de ejemplo salen iguales cada vez. */
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Tres meses de movimientos realistas para una persona en Barranquilla, terminando en `todayISO`.
 * El mes actual tiene más domicilios y cafés que los anteriores, para que se vean las recomendaciones.
 */
export function demoLedger(todayISO: string): Ledger {
  const rnd = random(42);
  const between = (a: number, b: number) => Math.round((a + rnd() * (b - a)) / 100) * 100;
  const current = monthOf(todayISO);
  const txs: Transaction[] = [];
  let n = 0;
  const add = (month: string, day: number, kind: Transaction["kind"], amount: number, categoryId: string, accountId: string, note: string) => {
    const d = Math.min(day, daysInMonth(month));
    const date = `${month}-${String(d).padStart(2, "0")}`;
    if (date > todayISO) return;
    txs.push({ id: `demo-${++n}`, kind, amount, categoryId, accountId, date, note, createdAt: `${date}T12:00:00.000Z` });
  };

  for (let i = 2; i >= 0; i--) {
    const m = addMonths(current, -i);
    const recent = i === 0;
    add(m, 1, "ingreso", 3_300_000, "salario", "bancolombia", "Pago de nómina");
    if (i === 1) add(m, 14, "ingreso", 350_000, "extra", "nequi", "Mantenimiento de computadores");
    add(m, 2, "gasto", 850_000, "hogar", "bancolombia", "Arriendo");
    add(m, 2, "gasto", 290_000, "iglesia", "bancolombia", "Diezmo");
    add(m, 3, "gasto", 200_000, "ahorro", "nequi", "Ahorro mensual");
    add(m, 6, "gasto", between(128_000, 162_000), "hogar", "bancolombia", "Air-e energía");
    add(m, 7, "gasto", between(58_000, 66_000), "hogar", "bancolombia", "Triple A agua");
    add(m, 9, "gasto", 89_900, "hogar", "bancolombia", "Claro hogar internet");
    add(m, 12, "gasto", 45_000, "hogar", "nequi", "Plan Tigo celular");
    add(m, 5, "gasto", 26_900, "suscripciones", "bancolombia", "Netflix");
    add(m, 8, "gasto", 17_900, "suscripciones", "bancolombia", "Spotify");
    add(m, 15, "gasto", 23_900, "suscripciones", "bancolombia", "Disney+");
    add(m, 18, "gasto", 19_900, "suscripciones", "nequi", "YouTube Premium");

    for (const day of [4, 11, 18, 25]) add(m, day, "gasto", between(78_000, 118_000), "mercado", "bancolombia", "D1");
    add(m, 16, "gasto", between(165_000, 205_000), "mercado", "bancolombia", "Olímpica");
    for (const day of [3, 10, 17, 24, 30]) add(m, day, "gasto", 20_000, "transporte", "nequi", "Recarga Transmetro");
    for (const day of recent ? [6, 13, 19] : [9, 22]) add(m, day, "gasto", between(11_000, 19_000), "transporte", "nequi", "DiDi");
    for (const day of [7, 14, 21, 28]) add(m, day, "gasto", 20_000, "iglesia", "efectivo", "Ofrenda");

    const deliveries = recent ? [2, 5, 7, 9, 11, 13, 15, 17, 19] : i === 1 ? [6, 13, 20, 27, 29] : [8, 16, 23, 30];
    for (const day of deliveries) add(m, day, "gasto", between(26_000, 46_000), "domicilios", "nequi", "Rappi");
    const coffees = recent ? [1, 2, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16, 18, 19] : [3, 7, 10, 14, 17, 21, 24, 28];
    for (const day of coffees) add(m, day, "gasto", between(5_500, 9_500), "cafe", "efectivo", recent && day % 2 ? "Tostao" : "Juan Valdez");

    add(m, 20, "gasto", 22_000, "salidas", "nequi", "Cine Colombia");
    if (i === 1) add(m, 26, "gasto", 129_900, "compras", "bancolombia", "Koaj");
    if (i === 2) add(m, 11, "gasto", 38_500, "salud", "efectivo", "Droguería La Rebaja");
    if (recent) add(m, 10, "gasto", 64_000, "educacion", "bancolombia", "Platzi");
  }

  return {
    categories: DEFAULT_CATEGORIES,
    accounts: DEFAULT_ACCOUNTS,
    rules: DEFAULT_RULES,
    transactions: txs.sort((a, b) => b.date.localeCompare(a.date)),
    budgets: [
      { categoryId: "mercado", limit: 600_000 },
      { categoryId: "domicilios", limit: 220_000 },
      { categoryId: "cafe", limit: 80_000 },
      { categoryId: "transporte", limit: 160_000 },
      { categoryId: "suscripciones", limit: 90_000 },
      { categoryId: "salidas", limit: 100_000 },
      { categoryId: "compras", limit: 150_000 },
    ],
    goals: [
      { id: "meta-guitarra", name: "Guitarra electroacústica", target: 1_800_000, saved: 650_000, deadline: `${addMonths(current, 5)}-28`, createdAt: todayISO },
      { id: "meta-emergencia", name: "Fondo de emergencia", target: 6_000_000, saved: 1_400_000, createdAt: todayISO },
    ],
  };
}

export function emptyLedger(): Ledger {
  return { categories: DEFAULT_CATEGORIES, accounts: DEFAULT_ACCOUNTS, rules: DEFAULT_RULES, transactions: [], budgets: [], goals: [] };
}
