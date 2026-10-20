import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface Prefs {
  theme: "auto" | "claro" | "oscuro";
  /** Oculta los montos en pantalla, para abrir la app en público. */
  hideAmounts: boolean;
}

export const initialPrefs: Prefs = { theme: "auto", hideAmounts: false };

const KEY = "cuadre:prefs";

export function loadPrefs(): Prefs {
  try {
    return { ...initialPrefs, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>) };
  } catch {
    return initialPrefs;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Sin almacenamiento: las preferencias duran mientras la pestaña esté abierta.
  }
}

const prefsSlice = createSlice({
  name: "prefs",
  initialState: initialPrefs,
  reducers: {
    prefsChanged(state, action: PayloadAction<Partial<Prefs>>) {
      Object.assign(state, action.payload);
    },
  },
});

export const { prefsChanged } = prefsSlice.actions;
export default prefsSlice.reducer;
