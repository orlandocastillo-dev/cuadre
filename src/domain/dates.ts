// Fechas como texto "AAAA-MM-DD" y meses como "AAAA-MM"

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}

/** Meses completos entre dos meses, contando ambos: ("2026-10", "2027-03") → 6. */
export function monthsBetween(from: string, to: string): number {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

// Qué parte del mes ya pasó, de 0 a 1. Un mes que ya terminó es 1
export function elapsedFraction(month: string, todayISO: string): number {
  const current = monthOf(todayISO);
  if (month < current) return 1;
  if (month > current) return 0;
  return dayOf(todayISO) / daysInMonth(month);
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function monthName(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

/** "octubre de 2026", o solo "octubre" si es el año actual. */
export function monthLabel(month: string, todayISO = today()): string {
  const name = monthName(month);
  return month.slice(0, 4) === todayISO.slice(0, 4) ? name : `${name} de ${month.slice(0, 4)}`;
}

export function shortMonth(month: string): string {
  return monthName(month).slice(0, 3);
}

/** "Hoy", "Ayer", "lunes 12", "3 de agosto" para fechas viejas. */
export function dayLabel(date: string, todayISO = today()): string {
  const d = new Date(`${date}T12:00:00`);
  const t = new Date(`${todayISO}T12:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff > 1 && diff < 7) return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
  const label = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === t.getFullYear() ? label : `${label} de ${d.getFullYear()}`;
}

/** "2026-03-15" → "marzo de 2027" estilo largo para metas. */
export function longMonth(month: string): string {
  return `${monthName(month)} de ${month.slice(0, 4)}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
