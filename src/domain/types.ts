export type Kind = "gasto" | "ingreso";

// Para qué es el gasto
export type Group = "necesidad" | "gusto" | "ahorro" | "aporte";

export interface Category {
  id: string;
  name: string;
  kind: Kind;
  group: Group;
  /** Nombre del ícono en components/Icon. */
  icon: string;
  /** Índice en la paleta de categorías (0-9). */
  color: number;
}

export interface Account {
  id: string;
  name: string;
  type: "efectivo" | "banco" | "billetera";
}

export interface Transaction {
  id: string;
  kind: Kind;
  /** Pesos colombianos, siempre positivo y sin decimales. */
  amount: number;
  categoryId: string;
  accountId: string;
  /** Fecha del movimiento, "AAAA-MM-DD". */
  date: string;
  note: string;
  createdAt: string;
}

/** Límite mensual para una categoría de gasto. */
export interface Budget {
  categoryId: string;
  limit: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  /** "AAAA-MM-DD", opcional. */
  deadline?: string;
  createdAt: string;
}

/** Si la descripción del banco contiene `pattern`, el movimiento va a `categoryId`. */
export interface Rule {
  pattern: string;
  categoryId: string;
}

export interface Ledger {
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  rules: Rule[];
}
