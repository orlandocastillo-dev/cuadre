import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { ledgerApi } from "../data/ledgerApi";
import prefsReducer, { savePrefs, type Prefs } from "../features/prefs";

const rootReducer = combineReducers({
  prefs: prefsReducer,
  [ledgerApi.reducerPath]: ledgerApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function makeStore(prefs?: Prefs) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: prefs ? ({ prefs } as Partial<RootState>) : undefined,
    middleware: (getDefault) => getDefault().concat(ledgerApi.middleware),
  });
  let last = store.getState().prefs;
  store.subscribe(() => {
    const now = store.getState().prefs;
    if (now !== last) {
      last = now;
      savePrefs(now);
    }
  });
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
