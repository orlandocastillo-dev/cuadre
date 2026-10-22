import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router";
import { useGetLedgerQuery } from "../data/ledgerApi";
import { monthOf, today } from "../domain/dates";
import { cop } from "../domain/money";
import { emptyLedger } from "../domain/seed";
import type { AppDispatch, RootState } from "./store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

const EMPTY = emptyLedger();

// Los datos del usuario
export function useLedger() {
  const q = useGetLedgerQuery();
  return { ...q, ledger: q.data ?? EMPTY };
}

/** El mes que se está viendo, guardado en la dirección (?mes=2026-10) para que sobreviva al recargar. */
export function useMonth(): [string, (m: string) => void] {
  const [params, setParams] = useSearchParams();
  const current = monthOf(useToday());
  const raw = params.get("mes");
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : current;
  const set = (m: string) =>
    setParams(
      (p) => {
        if (m === current) p.delete("mes");
        else p.set("mes", m);
        return p;
      },
      { replace: true },
    );
  return [month, set];
}

/** Formatea pesos respetando la opción de ocultar montos. */
export function useMoney() {
  const hide = useAppSelector((s) => s.prefs.hideAmounts);
  return useMemo(() => (n: number) => (hide ? "$ •••" : cop(n)), [hide]);
}

/** La fecha de hoy, fijada al montar el componente (llamar a Date en cada render no es puro). */
export function useToday(): string {
  const [d] = useState(today);
  return d;
}
