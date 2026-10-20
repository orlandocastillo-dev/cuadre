import { createContext, useContext } from "react";
import type { Kind, Transaction } from "../domain/types";

export interface SheetApi {
  /** Abre el formulario para un movimiento nuevo (con valores sugeridos) o para editar uno. */
  open: (options?: { edit?: Transaction; kind?: Kind; categoryId?: string }) => void;
}

export const SheetContext = createContext<SheetApi>({ open: () => {} });

export function useSheet() {
  return useContext(SheetContext);
}
