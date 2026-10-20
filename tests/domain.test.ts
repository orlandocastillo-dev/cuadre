import { describe, expect, it } from "vitest";
import { categorize, detectColumns, importStatement, parseCsv, parseDate } from "../src/domain/csv";
import { addMonths, dayLabel, elapsedFraction, monthsBetween } from "../src/domain/dates";
import { DEFAULT_RULES } from "../src/domain/defaults";
import { goalStatus } from "../src/domain/goals";
import { insights, split } from "../src/domain/insights";
import { cop, copShort, parseAmount } from "../src/domain/money";
import { findRecurring, merchantKey } from "../src/domain/recurring";
import { demoLedger, emptyLedger } from "../src/domain/seed";
import { categoryAverage, projectMonth, totals } from "../src/domain/summary";
import type { Ledger, Transaction } from "../src/domain/types";

const TODAY = "2026-10-20";
const incomeIds = new Set(["salario", "extra", "otros-ingresos"]);

let n = 0;
function tx(date: string, amount: number, categoryId: string, note = "", kind: Transaction["kind"] = "gasto"): Transaction {
  return { id: `t${++n}`, kind, amount, categoryId, accountId: "nequi", date, note, createdAt: `${date}T10:00:00Z` };
}
function ledgerWith(transactions: Transaction[], extra: Partial<Ledger> = {}): Ledger {
  return { ...emptyLedger(), transactions, ...extra };
}

describe("pesos", () => {
  it("formatea en pesos colombianos sin decimales", () => {
    expect(cop(1_250_000)).toBe("$1.250.000");
    expect(cop(8_500)).toBe("$8.500");
    expect(copShort(1_250_000)).toBe("$1,3 M");
    expect(copShort(85_000)).toBe("$85 mil");
  });

  it.each([
    ["12.500", 12_500],
    ["12500", 12_500],
    ["$ 12.500", 12_500],
    ["12,5k", 12_500],
    ["12 mil", 12_000],
    ["1,2 millones", 1_200_000],
    ["-45.000,00", -45_000],
    ["1.234.567", 1_234_567],
    ["3,300,000.50", 3_300_001],
  ])("lee %s", (text, value) => {
    expect(parseAmount(text)).toBe(value);
  });

  it("rechaza lo que no es un valor", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("hola")).toBeNull();
  });
});

describe("fechas", () => {
  it("cuenta meses y la parte del mes que pasó", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthsBetween("2026-10", "2027-03")).toBe(6);
    expect(elapsedFraction("2026-10", TODAY)).toBeCloseTo(20 / 31);
    expect(elapsedFraction("2026-09", TODAY)).toBe(1);
  });

  it("nombra los días como una persona", () => {
    expect(dayLabel("2026-10-20", TODAY)).toBe("Hoy");
    expect(dayLabel("2026-10-19", TODAY)).toBe("Ayer");
    expect(dayLabel("2026-10-18", TODAY)).toBe("domingo 18");
    expect(dayLabel("2026-08-03", TODAY)).toBe("3 de agosto");
  });
});

describe("totales y proyección", () => {
  it("separa consumo y ahorro", () => {
    const l = ledgerWith([tx("2026-10-01", 3_000_000, "salario", "", "ingreso"), tx("2026-10-02", 500_000, "mercado"), tx("2026-10-03", 200_000, "ahorro")]);
    const t = totals(l, "2026-10");
    expect(t).toMatchObject({ income: 3_000_000, expense: 700_000, spending: 500_000, saved: 200_000, balance: 2_300_000 });
  });

  it("no multiplica los pagos fijos al proyectar el mes", () => {
    const rent = (m: string) => tx(`${m}-02`, 900_000, "hogar", "Arriendo");
    const l = ledgerWith([rent("2026-08"), rent("2026-09"), rent("2026-10"), tx("2026-10-10", 100_000, "domicilios", "Rappi")]);
    const p = projectMonth(l, "2026-10", TODAY);
    expect(p.byCategory.get("hogar")).toBe(900_000);
    expect(p.byCategory.get("domicilios")).toBeCloseTo(100_000 / (20 / 31));
  });

  it("promedia solo los meses con historial", () => {
    const l = ledgerWith([tx("2026-09-05", 120_000, "domicilios"), tx("2026-08-05", 80_000, "domicilios")]);
    expect(categoryAverage(l, "domicilios", "2026-10")).toBe(100_000);
    expect(categoryAverage(ledgerWith([]), "domicilios", "2026-10")).toBeNull();
  });
});

describe("cobros que se repiten", () => {
  it("normaliza la descripción del banco", () => {
    expect(merchantKey("COMPRA NETFLIX.COM 8234 BOG")).toBe("netflix");
  });

  it("detecta suscripciones de valor parecido en meses seguidos", () => {
    const txs = ["2026-08", "2026-09", "2026-10"].flatMap((m) => [tx(`${m}-05`, 26_900, "suscripciones", "Netflix"), tx(`${m}-08`, 17_900, "suscripciones", "Spotify")]);
    const found = findRecurring(txs, "2026-10");
    expect(found.map((r) => r.label)).toEqual(["Netflix", "Spotify"]);
  });

  it("no confunde compras frecuentes ni valores muy distintos con una suscripción", () => {
    const weekly = ["04", "11", "18"].map((d) => tx(`2026-09-${d}`, 90_000, "mercado", "D1"));
    const weekly2 = ["02", "09"].map((d) => tx(`2026-10-${d}`, 90_000, "mercado", "D1"));
    const varying = [tx("2026-09-10", 20_000, "salidas", "Cine"), tx("2026-10-10", 60_000, "salidas", "Cine")];
    expect(findRecurring([...weekly, ...weekly2, ...varying], "2026-10")).toEqual([]);
  });
});

describe("recomendaciones", () => {
  const demo = demoLedger(TODAY);
  const tips = insights(demo, "2026-10", TODAY);
  const ids = tips.map((t) => t.id);

  it("avisa los presupuestos pasados primero", () => {
    expect(tips[0].tone).toBe("alerta");
    expect(ids).toContain("presupuesto-domicilios");
    expect(ids).toContain("presupuesto-cafe");
  });

  it("anticipa cuando el ritmo va a pasar un presupuesto", () => {
    const pace = tips.find((t) => t.id === "ritmo-mercado");
    expect(pace?.tone).toBe("aviso");
    expect(pace?.detail).toMatch(/terminarías el mes cerca de \$6\d\d\.000/);
  });

  it("encuentra los gastos hormiga y las suscripciones", () => {
    expect(tips.find((t) => t.id === "hormiga-cafe")?.title).toBe("14 gastos pequeños en café y antojos");
    expect(tips.find((t) => t.id === "suscripciones")?.detail).toContain("$88.600 al mes");
  });

  it("no compara contra el promedio categorías de pago fijo ni compras sueltas", () => {
    expect(ids).not.toContain("promedio-hogar");
    expect(ids).not.toContain("menos-compras");
  });

  it("compara con el propio promedio cuando no hay presupuesto", () => {
    const months = ["2026-07", "2026-08", "2026-09"];
    const past = months.flatMap((m) => [tx(`${m}-05`, 40_000, "salidas"), tx(`${m}-15`, 40_000, "salidas")]);
    const now = [tx("2026-10-03", 70_000, "salidas"), tx("2026-10-12", 70_000, "salidas")];
    const out = insights(ledgerWith([...past, ...now]), "2026-10", TODAY);
    expect(out.find((t) => t.id === "promedio-salidas")?.tone).toBe("aviso");
  });

  it("revisa si el ahorro alcanza para las metas", () => {
    expect(tips.find((t) => t.id === "meta-meta-guitarra")?.tone).toBe("bien");
  });

  it("no inventa recomendaciones sin datos", () => {
    expect(insights(emptyLedger(), "2026-10", TODAY)).toEqual([]);
  });

  it("reparte el mes entre necesidades, gustos, aportes y ahorro", () => {
    const s = split(demo, "2026-09");
    expect(s.ahorro).toBe(200_000);
    expect(s.necesidad).toBeGreaterThan(s.gusto);
  });
});

describe("metas", () => {
  const goal = { id: "g", name: "Guitarra", target: 1_800_000, saved: 600_000, deadline: "2027-03-28", createdAt: TODAY };

  it("calcula cuánto apartar al mes, redondeado a miles", () => {
    expect(goalStatus(goal, 250_000, TODAY)).toMatchObject({ left: 1_200_000, neededMonthly: 200_000, onTrack: true, eta: "2027-03" });
    expect(goalStatus(goal, 100_000, TODAY).onTrack).toBe(false);
  });

  it("sin ahorro no hay fecha estimada", () => {
    expect(goalStatus({ ...goal, deadline: undefined }, 0, TODAY)).toMatchObject({ eta: null, neededMonthly: null });
  });
});

describe("extractos del banco", () => {
  it("lee CSV con comillas y punto y coma", () => {
    expect(parseCsv('a;b\n"x;1";"di ""hola"""\n')).toEqual([
      ["a", "b"],
      ["x;1", 'di "hola"'],
    ]);
  });

  it("entiende las fechas de cada banco", () => {
    expect(parseDate("2026/10/18")).toBe("2026-10-18");
    expect(parseDate("18/10/2026")).toBe("2026-10-18");
    expect(parseDate("18-10-26")).toBe("2026-10-18");
    expect(parseDate("20261018")).toBe("2026-10-18");
    expect(parseDate("mañana")).toBeNull();
  });

  it("reconoce columnas de valor único o débito y crédito", () => {
    expect(detectColumns(["FECHA", "DESCRIPCIÓN", "SUCURSAL", "VALOR", "SALDO"])).toEqual({ date: 0, description: 1, amount: 3 });
    expect(detectColumns(["Fecha del movimiento", "Descripción", "Débito", "Crédito"])).toEqual({ date: 0, description: 1, debit: 2, credit: 3 });
    expect(detectColumns(["a", "b"])).toBeNull();
  });

  it("clasifica por palabras clave y separa ingresos", () => {
    expect(categorize("COMPRA EN RAPPI COLOMBIA", "gasto", DEFAULT_RULES, incomeIds)).toBe("domicilios");
    expect(categorize("PAGO PSE AIR-E", "gasto", DEFAULT_RULES, incomeIds)).toBe("hogar");
    expect(categorize("PAGO DE NOMINA ACME", "ingreso", DEFAULT_RULES, incomeIds)).toBe("salario");
    expect(categorize("TRANSFERENCIA", "gasto", DEFAULT_RULES, incomeIds)).toBe("otros");
  });

  it("importa un extracto completo y salta las filas inválidas", () => {
    const csv = "Banco de ejemplo\nFecha,Descripción,Valor\n2026/10/18,RAPPI,-38.900\n2026/10/01,PAGO DE NOMINA,3.300.000\n,TOTAL,\n";
    const r = importStatement(csv, DEFAULT_RULES, incomeIds);
    expect(r.rows).toEqual([
      { date: "2026-10-18", description: "RAPPI", amount: 38_900, kind: "gasto", categoryId: "domicilios" },
      { date: "2026-10-01", description: "PAGO DE NOMINA", amount: 3_300_000, kind: "ingreso", categoryId: "salario" },
    ]);
    expect(r.skipped).toBe(1);
  });

  it("explica cuando el archivo no tiene las columnas", () => {
    expect(importStatement("x,y\n1,2", DEFAULT_RULES, incomeIds).error).toMatch(/columnas/);
  });
});
