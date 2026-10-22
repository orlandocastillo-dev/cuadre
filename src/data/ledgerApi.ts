import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Budget, Category, Goal, Ledger, Rule, Transaction } from "../domain/types";
import type { Repository } from "./repository";

let repo: Repository;

/** Se llama una vez al arrancar: aquí se decide si los datos van al navegador o a un servidor. */
export function setRepository(r: Repository) {
  repo = r;
}

export function currentRepository(): Repository {
  return repo;
}

type Err = { message: string };

async function run<T>(fn: () => Promise<T>): Promise<{ data: T } | { error: Err }> {
  try {
    return { data: await fn() };
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : "No se pudo guardar. Inténtalo de nuevo." } };
  }
}

// RTK Query sobre el repositorio
export const ledgerApi = createApi({
  reducerPath: "ledgerApi",
  baseQuery: fakeBaseQuery<Err>(),
  tagTypes: ["Ledger"],
  endpoints: (build) => ({
    getLedger: build.query<Ledger, void>({
      queryFn: () => run<Ledger>(async () => structuredClone(await repo.load())),
      providesTags: ["Ledger"],
    }),
    saveTransaction: build.mutation<Transaction, Transaction>({
      queryFn: (t) => run(() => repo.saveTransaction(t)),
      onQueryStarted: optimistic((l, t) => {
        const i = l.transactions.findIndex((x) => x.id === t.id);
        if (i >= 0) l.transactions[i] = t;
        else l.transactions.unshift(t);
      }),
    }),
    deleteTransaction: build.mutation<void, string>({
      queryFn: (id) => run(() => repo.deleteTransaction(id)),
      onQueryStarted: optimistic((l, id) => {
        l.transactions = l.transactions.filter((t) => t.id !== id);
      }),
    }),
    addTransactions: build.mutation<number, Transaction[]>({
      queryFn: (ts) => run(() => repo.addTransactions(ts)),
      onQueryStarted: optimistic((l, ts) => {
        l.transactions.unshift(...ts);
      }),
    }),
    saveBudget: build.mutation<void, Budget>({
      queryFn: (b) => run(() => repo.saveBudget(b)),
      onQueryStarted: optimistic((l, b) => {
        l.budgets = [...l.budgets.filter((x) => x.categoryId !== b.categoryId), b];
      }),
    }),
    deleteBudget: build.mutation<void, string>({
      queryFn: (id) => run(() => repo.deleteBudget(id)),
      onQueryStarted: optimistic((l, id) => {
        l.budgets = l.budgets.filter((b) => b.categoryId !== id);
      }),
    }),
    saveGoal: build.mutation<Goal, Goal>({
      queryFn: (g) => run(() => repo.saveGoal(g)),
      onQueryStarted: optimistic((l, g) => {
        const i = l.goals.findIndex((x) => x.id === g.id);
        if (i >= 0) l.goals[i] = g;
        else l.goals.push(g);
      }),
    }),
    deleteGoal: build.mutation<void, string>({
      queryFn: (id) => run(() => repo.deleteGoal(id)),
      onQueryStarted: optimistic((l, id) => {
        l.goals = l.goals.filter((g) => g.id !== id);
      }),
    }),
    saveCategory: build.mutation<void, Category>({
      queryFn: (c) => run(() => repo.saveCategory(c)),
      onQueryStarted: optimistic((l, c) => {
        const i = l.categories.findIndex((x) => x.id === c.id);
        if (i >= 0) l.categories[i] = c;
        else l.categories.push(c);
      }),
    }),
    saveRule: build.mutation<void, Rule>({
      queryFn: (r) => run(() => repo.saveRule(r)),
      onQueryStarted: optimistic((l, r) => {
        l.rules = [r, ...l.rules.filter((x) => x.pattern !== r.pattern)];
      }),
    }),
    replaceAll: build.mutation<void, Ledger>({
      queryFn: (ledger) => run(() => repo.replaceAll(ledger)),
      invalidatesTags: ["Ledger"],
    }),
  }),
});

/** Aplica el cambio a la caché de inmediato y lo deshace si la base de datos falla. */
function optimistic<A>(apply: (draft: Ledger, arg: A) => void) {
  return async (arg: A, { dispatch, queryFulfilled }: { dispatch: (a: unknown) => unknown; queryFulfilled: Promise<unknown> }) => {
    const patch = dispatch(ledgerApi.util.updateQueryData("getLedger", undefined, (draft) => apply(draft, arg))) as { undo: () => void };
    try {
      await queryFulfilled;
    } catch {
      patch.undo();
    }
  };
}

export const {
  useGetLedgerQuery,
  useSaveTransactionMutation,
  useDeleteTransactionMutation,
  useAddTransactionsMutation,
  useSaveBudgetMutation,
  useDeleteBudgetMutation,
  useSaveGoalMutation,
  useDeleteGoalMutation,
  useSaveCategoryMutation,
  useSaveRuleMutation,
  useReplaceAllMutation,
} = ledgerApi;
