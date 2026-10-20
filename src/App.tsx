import { useState } from "react";
import { RouterProvider, type createHashRouter } from "react-router";
import { Bienvenida } from "./pages/Bienvenida";

/** La primera vez se muestra la bienvenida; después, directo a la app. */
export function App({ router, firstRun }: { router: ReturnType<typeof createHashRouter>; firstRun: boolean }) {
  const [ready, setReady] = useState(!firstRun);
  return ready ? <RouterProvider router={router} /> : <Bienvenida onDone={() => setReady(true)} />;
}
