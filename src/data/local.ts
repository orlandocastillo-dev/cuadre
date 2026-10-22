import { emptyLedger } from "../domain/seed";
import type { Ledger } from "../domain/types";
import type { Repository } from "./repository";

const KEY = "cuadre:ledger:v1";

// Guarda todo en el navegador
export class LocalRepository implements Repository {
  readonly kind = "local" as const;
  private cache: Ledger | null = null;
  private storage: Storage | null;

  constructor(storage: Storage | null = safeStorage()) {
    this.storage = storage;
  }

  /** null = todavía no hay datos guardados (primera vez que se abre la app). */
  hasData(): boolean {
    try {
      return !!this.storage?.getItem(KEY);
    } catch {
      return false;
    }
  }

  async load(): Promise<Ledger> {
    if (this.cache) return this.cache;
    try {
      const raw = this.storage?.getItem(KEY);
      this.cache = raw ? { ...emptyLedger(), ...(JSON.parse(raw) as Partial<Ledger>) } : emptyLedger();
    } catch {
      this.cache = emptyLedger();
    }
    return this.cache;
  }

  private async update(change: (l: Ledger) => Ledger): Promise<void> {
    const next = change(await this.load());
    this.cache = next;
    try {
      this.storage?.setItem(KEY, JSON.stringify(next));
    } catch {
      // Sin espacio o en modo privado: los datos quedan en memoria mientras la pestaña esté abierta.
    }
  }

  async saveTransaction(t: Parameters<Repository["saveTransaction"]>[0]) {
    await this.update((l) => ({ ...l, transactions: upsert(l.transactions, t) }));
    return t;
  }

  async deleteTransaction(id: string) {
    await this.update((l) => ({ ...l, transactions: l.transactions.filter((t) => t.id !== id) }));
  }

  async addTransactions(ts: Parameters<Repository["addTransactions"]>[0]) {
    await this.update((l) => ({ ...l, transactions: [...ts, ...l.transactions] }));
    return ts.length;
  }

  async saveBudget(b: Parameters<Repository["saveBudget"]>[0]) {
    await this.update((l) => ({ ...l, budgets: [...l.budgets.filter((x) => x.categoryId !== b.categoryId), b] }));
  }

  async deleteBudget(categoryId: string) {
    await this.update((l) => ({ ...l, budgets: l.budgets.filter((b) => b.categoryId !== categoryId) }));
  }

  async saveGoal(g: Parameters<Repository["saveGoal"]>[0]) {
    await this.update((l) => ({ ...l, goals: upsert(l.goals, g) }));
    return g;
  }

  async deleteGoal(id: string) {
    await this.update((l) => ({ ...l, goals: l.goals.filter((g) => g.id !== id) }));
  }

  async saveCategory(c: Parameters<Repository["saveCategory"]>[0]) {
    await this.update((l) => ({ ...l, categories: upsert(l.categories, c) }));
  }

  async saveRule(r: Parameters<Repository["saveRule"]>[0]) {
    await this.update((l) => ({ ...l, rules: [r, ...l.rules.filter((x) => x.pattern !== r.pattern)] }));
  }

  async replaceAll(ledger: Ledger) {
    await this.update(() => ledger);
  }
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [item, ...list];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
