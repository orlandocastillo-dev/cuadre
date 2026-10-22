import { parseAmount } from "./money";
import type { Kind, Rule } from "./types";

/** Lee un CSV con comillas, separado por coma, punto y coma o tabulación (se detecta solo). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  // El separador se decide con las primeras líneas: algunos bancos ponen un título antes del encabezado.
  const sample = clean.split("\n").slice(0, 8);
  const delimiter = [";", "\t", ","]
    .map((d) => ({ d, n: Math.max(...sample.map((l) => l.split(d).length)) }))
    .sort((a, b) => b.n - a.n)[0].d;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((c) => c)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

/** "18/10/2026", "2026/10/18", "2026-10-18", "18-10-26", "20261018" → "2026-10-18". */
export function parseDate(input: string): string | null {
  const t = input.trim().slice(0, 10);
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface ColumnMap {
  date: number;
  description: number;
  /** Una sola columna con signo (Bancolombia), o dos columnas débito / crédito. */
  amount?: number;
  debit?: number;
  credit?: number;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// Reconoce las columnas por su encabezado
export function detectColumns(header: string[]): ColumnMap | null {
  const h = header.map(norm);
  const taken = new Set<number>();
  const find = (...words: string[]) => {
    // Primero la palabra más específica: "descripcion" gana sobre "movimiento".
    for (const w of words) {
      const i = h.findIndex((c, idx) => !taken.has(idx) && c.includes(w));
      if (i >= 0) {
        taken.add(i);
        return i;
      }
    }
    return -1;
  };
  const date = find("fecha", "date");
  const description = find("descripcion", "detalle", "concepto", "description", "referencia", "movimiento");
  const amount = find("valor", "monto", "importe", "amount");
  const debit = find("debito", "cargo", "salida", "retiro");
  const credit = find("credito", "abono", "entrada", "deposito");
  if (date < 0 || description < 0) return null;
  if (debit >= 0 && credit >= 0 && debit !== credit) return { date, description, debit, credit };
  if (amount >= 0) return { date, description, amount };
  return null;
}

export interface ImportRow {
  date: string;
  description: string;
  amount: number;
  kind: Kind;
  categoryId: string;
}

/** Elige la categoría con la regla más específica (el patrón más largo) que aparezca en la descripción. */
export function categorize(description: string, kind: Kind, rules: Rule[], incomeIds: Set<string>): string {
  const d = ` ${norm(description)} `;
  const match = rules
    .filter((r) => d.includes(norm(r.pattern)) && incomeIds.has(r.categoryId) === (kind === "ingreso"))
    .sort((a, b) => b.pattern.length - a.pattern.length)[0];
  if (match) return match.categoryId;
  return kind === "ingreso" ? "otros-ingresos" : "otros";
}

export interface ImportResult {
  rows: ImportRow[];
  skipped: number;
  error?: string;
}

/** Convierte el texto de un extracto en movimientos listos para revisar antes de guardar. */
export function importStatement(text: string, rules: Rule[], incomeIds: Set<string>): ImportResult {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((r) => detectColumns(r));
  if (headerIndex < 0) {
    return { rows: [], skipped: rows.length, error: "No encontramos las columnas de fecha, descripción y valor. Revisa que el archivo tenga encabezados." };
  }
  const cols = detectColumns(rows[headerIndex])!;
  const out: ImportRow[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerIndex + 1)) {
    const date = parseDate(r[cols.date] ?? "");
    const description = (r[cols.description] ?? "").replace(/\s+/g, " ").trim();
    let value: number | null;
    if (cols.amount !== undefined) value = parseAmount(r[cols.amount] ?? "");
    else {
      const debit = parseAmount(r[cols.debit!] ?? "") ?? 0;
      const credit = parseAmount(r[cols.credit!] ?? "") ?? 0;
      value = credit ? Math.abs(credit) : debit ? -Math.abs(debit) : null;
    }
    if (!date || value === null || value === 0) {
      skipped++;
      continue;
    }
    const kind: Kind = value > 0 ? "ingreso" : "gasto";
    out.push({ date, description, amount: Math.abs(value), kind, categoryId: categorize(description, kind, rules, incomeIds) });
  }
  return { rows: out, skipped };
}
