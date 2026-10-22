import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyLedger } from "../domain/seed";
import type { Account, Budget, Category, Goal, Ledger, Rule, Transaction } from "../domain/types";
import type { Repository } from "./repository";

// Filas de la base (español, snake_case) <-> tipos de la app

export interface FilaCategoria { id: string; nombre: string; tipo: Category["kind"]; grupo: Category["group"]; icono: string; color: number }
export interface FilaCuenta { id: string; nombre: string; tipo: Account["type"] }
export interface FilaMovimiento { id: string; tipo: Transaction["kind"]; monto: number | string; categoria_id: string; cuenta_id: string; fecha: string; nota: string; creado_en: string }
export interface FilaPresupuesto { categoria_id: string; limite: number | string }
export interface FilaMeta { id: string; nombre: string; objetivo: number | string; ahorrado: number | string; fecha_limite: string | null; creado_en: string }
export interface FilaRegla { patron: string; categoria_id: string }

export const desde = {
  categoria: (f: FilaCategoria): Category => ({ id: f.id, name: f.nombre, kind: f.tipo, group: f.grupo, icon: f.icono, color: Number(f.color) }),
  cuenta: (f: FilaCuenta): Account => ({ id: f.id, name: f.nombre, type: f.tipo }),
  movimiento: (f: FilaMovimiento): Transaction => ({
    id: f.id,
    kind: f.tipo,
    amount: Number(f.monto),
    categoryId: f.categoria_id,
    accountId: f.cuenta_id,
    date: f.fecha.slice(0, 10),
    note: f.nota ?? "",
    createdAt: new Date(f.creado_en).toISOString(),
  }),
  presupuesto: (f: FilaPresupuesto): Budget => ({ categoryId: f.categoria_id, limit: Number(f.limite) }),
  meta: (f: FilaMeta): Goal => ({
    id: f.id,
    name: f.nombre,
    target: Number(f.objetivo),
    saved: Number(f.ahorrado),
    ...(f.fecha_limite ? { deadline: f.fecha_limite.slice(0, 10) } : {}),
    createdAt: new Date(f.creado_en).toISOString(),
  }),
  regla: (f: FilaRegla): Rule => ({ pattern: f.patron, categoryId: f.categoria_id }),
};

export const hacia = {
  categoria: (c: Category, user_id: string) => ({ user_id, id: c.id, nombre: c.name, tipo: c.kind, grupo: c.group, icono: c.icon, color: c.color }),
  movimiento: (t: Transaction, user_id: string) => ({
    user_id,
    id: t.id,
    tipo: t.kind,
    monto: Math.round(t.amount),
    categoria_id: t.categoryId,
    cuenta_id: t.accountId,
    fecha: t.date,
    nota: t.note.slice(0, 200),
    creado_en: t.createdAt,
  }),
  presupuesto: (b: Budget, user_id: string) => ({ user_id, categoria_id: b.categoryId, limite: Math.round(b.limit) }),
  meta: (g: Goal, user_id: string) => ({
    user_id,
    id: g.id,
    nombre: g.name,
    objetivo: Math.round(g.target),
    ahorrado: Math.round(g.saved),
    fecha_limite: g.deadline || null,
    creado_en: g.createdAt,
  }),
  regla: (r: Rule, user_id: string) => ({ user_id, patron: r.pattern, categoria_id: r.categoryId }),
};

/** Supabase entrega máximo 1.000 filas por consulta: se piden por páginas. */
const PAGINA = 1000;

// Los datos en Supabase, a nombre del usuario que inició sesión
export class SupabaseRepository implements Repository {
  readonly kind = "remoto" as const;

  private readonly db: SupabaseClient;
  private readonly userId: string;

  constructor(db: SupabaseClient, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  private async todas<T>(tabla: string, orden?: string): Promise<T[]> {
    const filas: T[] = [];
    for (let desdeFila = 0; ; desdeFila += PAGINA) {
      let q = this.db.from(tabla).select("*").range(desdeFila, desdeFila + PAGINA - 1);
      if (orden) q = q.order(orden, { ascending: false });
      const { data, error } = await q;
      if (error) throw traducir(error);
      filas.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGINA) return filas;
    }
  }

  async load(): Promise<Ledger> {
    const [categorias, cuentas, movimientos, presupuestos, metas, reglas] = await Promise.all([
      this.todas<FilaCategoria>("categorias"),
      this.todas<FilaCuenta>("cuentas"),
      this.todas<FilaMovimiento>("movimientos", "fecha"),
      this.todas<FilaPresupuesto>("presupuestos"),
      this.todas<FilaMeta>("metas"),
      this.todas<FilaRegla>("reglas"),
    ]);
    // Cuenta nueva: se crean las categorías y cuentas de siempre.
    if (categorias.length === 0) {
      const inicial = emptyLedger();
      await this.replaceAll(inicial);
      return inicial;
    }
    return {
      categories: categorias.map(desde.categoria),
      accounts: cuentas.map(desde.cuenta),
      transactions: movimientos.map(desde.movimiento).sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date))),
      budgets: presupuestos.map(desde.presupuesto),
      goals: metas.map(desde.meta),
      rules: reglas.map(desde.regla),
    };
  }

  /** true si la cuenta todavía no tiene movimientos (para ofrecer pasar los del celular). */
  async estaVacia(): Promise<boolean> {
    const { count, error } = await this.db.from("movimientos").select("id", { count: "exact", head: true });
    if (error) throw traducir(error);
    return !count;
  }

  private async escribir(p: PromiseLike<{ error: unknown }>) {
    const { error } = await p;
    if (error) throw traducir(error);
  }

  async saveTransaction(t: Transaction) {
    await this.escribir(this.db.from("movimientos").upsert(hacia.movimiento(t, this.userId), { onConflict: "user_id,id" }));
    return t;
  }

  async deleteTransaction(id: string) {
    await this.escribir(this.db.from("movimientos").delete().eq("user_id", this.userId).eq("id", id));
  }

  async addTransactions(ts: Transaction[]) {
    for (let i = 0; i < ts.length; i += 500) {
      const lote = ts.slice(i, i + 500).map((t) => hacia.movimiento(t, this.userId));
      await this.escribir(this.db.from("movimientos").upsert(lote, { onConflict: "user_id,id", ignoreDuplicates: true }));
    }
    return ts.length;
  }

  async saveBudget(b: Budget) {
    await this.escribir(this.db.from("presupuestos").upsert(hacia.presupuesto(b, this.userId), { onConflict: "user_id,categoria_id" }));
  }

  async deleteBudget(categoryId: string) {
    await this.escribir(this.db.from("presupuestos").delete().eq("user_id", this.userId).eq("categoria_id", categoryId));
  }

  async saveGoal(g: Goal) {
    await this.escribir(this.db.from("metas").upsert(hacia.meta(g, this.userId), { onConflict: "user_id,id" }));
    return g;
  }

  async deleteGoal(id: string) {
    await this.escribir(this.db.from("metas").delete().eq("user_id", this.userId).eq("id", id));
  }

  async saveCategory(c: Category) {
    await this.escribir(this.db.from("categorias").upsert(hacia.categoria(c, this.userId), { onConflict: "user_id,id" }));
  }

  async saveRule(r: Rule) {
    await this.escribir(this.db.from("reglas").upsert(hacia.regla(r, this.userId), { onConflict: "user_id,patron" }));
  }

  /** Todo en una sola transacción en la base (función reemplazar_todo): o queda completo o no cambia nada. */
  async replaceAll(ledger: Ledger) {
    await this.escribir(this.db.rpc("reemplazar_todo", { datos: ledger }));
  }
}

/** Mensajes de la base en palabras normales. */
export function traducir(error: unknown): Error {
  const e = error as { message?: string; code?: string };
  const msg = e?.message ?? "";
  if (/fetch|network|Failed to/i.test(msg)) return new Error("No hay conexión. Revisa el internet e inténtalo de nuevo.");
  if (e?.code === "42501" || /row-level security|permission denied/i.test(msg)) return new Error("Tu sesión expiró. Vuelve a entrar.");
  if (e?.code === "23503") return new Error("Hay movimientos con una categoría o cuenta que no existe.");
  if (e?.code === "23514") return new Error("Hay un valor que no es válido (por ejemplo, un monto en cero).");
  return new Error("No se pudo guardar. Inténtalo de nuevo.");
}
