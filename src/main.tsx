import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "./styles/app.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { createHashRouter, Navigate } from "react-router";
import { App } from "./App";
import { makeStore } from "./app/store";
import { Layout } from "./components/Layout";
import { setRepository } from "./data/ledgerApi";
import { LocalRepository } from "./data/local";
import { loadPrefs } from "./features/prefs";
import { Ajustes } from "./pages/Ajustes";
import { Importar } from "./pages/Importar";
import { Metas } from "./pages/Metas";
import { Movimientos } from "./pages/Movimientos";
import { Presupuestos } from "./pages/Presupuestos";
import { Resumen } from "./pages/Resumen";

// Aquí se elige dónde viven los datos. Con un backend, se cambia esta línea por su repositorio.
const repository = new LocalRepository();
setRepository(repository);

const store = makeStore(loadPrefs());

const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Resumen /> },
      { path: "movimientos", element: <Movimientos /> },
      { path: "presupuestos", element: <Presupuestos /> },
      { path: "metas", element: <Metas /> },
      { path: "importar", element: <Importar /> },
      { path: "ajustes", element: <Ajustes /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <App router={router} firstRun={!repository.hasData()} />
    </Provider>
  </StrictMode>,
);
