import type { Budget, Category, Goal, Ledger, Rule, Transaction } from "../domain/types";

/**
 * Todo lo que la app necesita de la base de datos. Hoy lo cumple LocalRepository (el navegador);
 * para tener cuentas y datos en un servidor basta con otra implementación de esta interfaz
 * (Supabase o una API propia) y las pantallas no cambian.
 */
export interface Repository {
  readonly kind: "local" | "remoto";
  load(): Promise<Ledger>;
  saveTransaction(t: Transaction): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  addTransactions(ts: Transaction[]): Promise<number>;
  saveBudget(b: Budget): Promise<void>;
  deleteBudget(categoryId: string): Promise<void>;
  saveGoal(g: Goal): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
  saveCategory(c: Category): Promise<void>;
  saveRule(r: Rule): Promise<void>;
  replaceAll(ledger: Ledger): Promise<void>;
}
