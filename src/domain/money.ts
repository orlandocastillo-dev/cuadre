const full = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** 1250000 → "$ 1.250.000" (con el espacio fino que usa es-CO, normalizado a espacio simple). */
export function cop(amount: number): string {
  return full.format(Math.round(amount)).replace(/\s/g, " ").replace("$ ", "$");
}

/** Para gráficos y espacios cortos: 1250000 → "$1,3 M", 85000 → "$85 mil". */
export function copShort(amount: number): string {
  const a = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000) return `${sign}$${Math.round(a / 1_000).toLocaleString("es-CO")} mil`;
  return `${sign}$${Math.round(a)}`;
}

// Lee un valor como lo escribe la gente en Colombia
export function parseAmount(input: string): number | null {
  let t = input.trim().toLowerCase().replace(/\$|cop|\s+/g, "");
  if (!t) return null;
  let factor = 1;
  const suffix = t.match(/(k|mil|m|millon(?:es)?|mill)$/);
  if (suffix) {
    factor = suffix[1] === "k" || suffix[1] === "mil" ? 1_000 : 1_000_000;
    t = t.slice(0, -suffix[1].length);
  }
  const negative = t.startsWith("-") || (t.startsWith("(") && t.endsWith(")"));
  t = t.replace(/[-()]/g, "");
  if (!/^[\d.,]+$/.test(t)) return null;

  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // El separador que va de último es el decimal: "1.234,50" o "1,234.50".
    normalized = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // "12,5" es decimal; "12,500" es miles.
    normalized = /,\d{3}$/.test(t) && factor === 1 ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = /\.\d{3}$/.test(t) && factor === 1 ? t.replace(/\./g, "") : t;
    if ((t.match(/\./g) ?? []).length > 1) normalized = t.replace(/\./g, "");
  } else {
    normalized = t;
  }
  const value = Number(normalized) * factor;
  if (!Number.isFinite(value)) return null;
  return Math.round(negative ? -value : value);
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
