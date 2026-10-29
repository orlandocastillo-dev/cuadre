import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { makeStore } from "../src/app/store";
import { Layout } from "../src/components/Layout";
import { ledgerApi, setRepository } from "../src/data/ledgerApi";
import { LocalRepository } from "../src/data/local";
import { today } from "../src/domain/dates";
import { demoLedger, emptyLedger } from "../src/domain/seed";
import type { Ledger } from "../src/domain/types";
import { Importar } from "../src/pages/Importar";
import { Metas } from "../src/pages/Metas";
import { Movimientos } from "../src/pages/Movimientos";
import { Presupuestos } from "../src/pages/Presupuestos";
import { Armar } from "../src/pages/Armar";
import { Resumen } from "../src/pages/Resumen";

/** Un almacenamiento en memoria para cada prueba. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

let repo: LocalRepository;

async function renderApp(path = "/", ledger: Ledger = emptyLedger()) {
  repo = new LocalRepository(memoryStorage());
  await repo.replaceAll(ledger);
  setRepository(repo);
  const store = makeStore();
  store.dispatch(ledgerApi.util.resetApiState());
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Layout />,
        children: [
          { index: true, element: <Resumen /> },
          { path: "movimientos", element: <Movimientos /> },
          { path: "presupuestos", element: <Presupuestos /> },
          { path: "armar", element: <Armar /> },
          { path: "metas", element: <Metas /> },
          { path: "importar", element: <Importar /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  );
  return { store, router };
}

beforeEach(() => {
  // jsdom no tiene showModal; el diálogo se abre con el atributo open.
  HTMLDialogElement.prototype.showModal = undefined as never;
  HTMLDialogElement.prototype.close = undefined as never;
});

describe("registrar un gasto", () => {
  it("lo guarda, actualiza el resumen y persiste en el repositorio", async () => {
    await renderApp("/");
    await userEvent.click(screen.getAllByRole("button", { name: /Nuevo movimiento/ })[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Ingreso" }));
    await userEvent.type(within(dialog).getByLabelText("Valor en pesos"), "3000000");
    expect(within(dialog).getByLabelText("Valor en pesos")).toHaveValue("3.000.000");
    await userEvent.click(within(dialog).getByRole("button", { name: /Salario/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar ingreso" }));

    await userEvent.click(screen.getAllByRole("button", { name: /Nuevo movimiento/ })[0]);
    const second = await screen.findByRole("dialog");
    await userEvent.type(within(second).getByLabelText("Valor en pesos"), "32500");
    await userEvent.click(within(second).getByRole("button", { name: /Domicilios/ }));
    await userEvent.type(within(second).getByLabelText("Nota"), "Rappi");
    await userEvent.click(within(second).getByRole("button", { name: "Registrar gasto" }));

    expect(await screen.findByText("$2.967.500")).toBeInTheDocument();
    const saved = await repo.load();
    expect(saved.transactions.map((t) => [t.kind, t.amount, t.categoryId, t.note])).toEqual([
      ["gasto", 32_500, "domicilios", "Rappi"],
      ["ingreso", 3_000_000, "salario", ""],
    ]);
  });

  it("pide valor y categoría", async () => {
    await renderApp("/");
    await userEvent.click(screen.getAllByRole("button", { name: /Nuevo movimiento/ })[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar gasto" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Escribe el valor");
    await userEvent.type(within(dialog).getByLabelText("Valor en pesos"), "5000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar gasto" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Elige una categoría");
  });
});

describe("con datos de ejemplo", () => {
  it("muestra las recomendaciones del mes", async () => {
    await renderApp("/", demoLedger(today()));
    expect(await screen.findByRole("heading", { name: "Recomendaciones" })).toBeInTheDocument();
    expect(screen.getByText(/Te pasaste en domicilios/)).toBeInTheDocument();
  });

  it("edita y elimina un movimiento desde la lista", async () => {
    await renderApp("/movimientos", demoLedger(today()));
    const before = (await repo.load()).transactions.length;
    const rows = await screen.findAllByRole("button", { name: /Rappi/ });
    await userEvent.click(rows[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Editar movimiento" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Eliminar/ }));
    await waitFor(async () => expect((await repo.load()).transactions.length).toBe(before - 1));
  });

  it("cambia un presupuesto", async () => {
    await renderApp("/presupuestos", demoLedger(today()));
    await userEvent.click(await screen.findByRole("button", { name: /Cambiar presupuesto de Mercado/ }));
    const input = screen.getByLabelText("Presupuesto de Mercado");
    await userEvent.clear(input);
    await userEvent.type(input, "700.000");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(async () => expect((await repo.load()).budgets.find((b) => b.categoryId === "mercado")?.limit).toBe(700_000));
  });

  it("abona a una meta y lo registra como ahorro", async () => {
    await renderApp("/metas", demoLedger(today()));
    const goal = (await screen.findByRole("heading", { name: "Guitarra electroacústica" })).closest("li")!;
    await userEvent.click(within(goal as HTMLElement).getByRole("button", { name: "Abonar" }));
    await userEvent.type(within(goal as HTMLElement).getByLabelText("Valor del abono"), "100000");
    await userEvent.click(within(goal as HTMLElement).getByRole("button", { name: "Abonar" }));
    await waitFor(async () => {
      const l = await repo.load();
      expect(l.goals.find((g) => g.id === "meta-guitarra")?.saved).toBe(750_000);
      expect(l.transactions.some((t) => t.note === "Abono a Guitarra electroacústica" && t.categoryId === "ahorro")).toBe(true);
    });
  });
});

describe("importar extracto", () => {
  it("revisa, aprende la categoría corregida y guarda", async () => {
    await renderApp("/importar");
    await userEvent.click(await screen.findByRole("button", { name: "Usar un ejemplo" }));
    await userEvent.click(screen.getByRole("button", { name: "Revisar movimientos" }));
    const row = screen.getByText("Transf Nequi Juan Perez").closest("li")!;
    await userEvent.selectOptions(within(row as HTMLElement).getByRole("combobox"), "salidas");
    await userEvent.click(screen.getByRole("button", { name: "Importar 6 movimientos" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Se importaron 6 movimientos");
    const l = await repo.load();
    expect(l.transactions).toHaveLength(6);
    expect(l.transactions.find((t) => t.note === "Transf Nequi Juan Perez")?.categoryId).toBe("salidas");
    expect(l.rules[0]).toEqual({ pattern: "transf nequi juan", categoryId: "salidas" });
  });
});

describe("armar el presupuesto", () => {
  it("propone límites según el ingreso y los guarda", async () => {
    const user = userEvent.setup();
    await renderApp("/armar");
    await user.type(screen.getByLabelText("Ingreso mensual"), "2000000");
    await user.click(screen.getByRole("button", { name: "Seguir" }));
    await user.click(screen.getByRole("button", { name: /Seguir con/ }));
    // Arriendo y servicios se lleva el 30 %
    expect(screen.getByLabelText("Límite para Arriendo y servicios")).toHaveValue("600.000");
    await user.click(screen.getByRole("button", { name: "Guardar mi presupuesto" }));
    await waitFor(async () => {
      const l = await repo.load();
      expect(l.budgets.find((b) => b.categoryId === "hogar")?.limit).toBe(600000);
      expect(l.transactions.some((t) => t.kind === "ingreso" && t.amount === 2000000)).toBe(true);
    });
  });
});
