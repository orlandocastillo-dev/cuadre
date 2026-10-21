import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Provider } from "react-redux";
import { createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { makeStore } from "../src/app/store";
import { fuerzaClave, mensajeAuth } from "../src/auth/cuenta";
import { Layout } from "../src/components/Layout";
import { LocalRepository } from "../src/data/local";
import { usarClientePrueba } from "../src/data/nube";
import { desde, hacia } from "../src/data/supabase";
import { today } from "../src/domain/dates";
import { demoLedger } from "../src/domain/seed";
import { Ajustes } from "../src/pages/Ajustes";
import { Movimientos } from "../src/pages/Movimientos";
import { Resumen } from "../src/pages/Resumen";
import { fakeSupabase } from "./fakeSupabase";

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

let fake: ReturnType<typeof fakeSupabase>;

function montar({ confirmarCorreo = false, local = new LocalRepository(memoryStorage()) } = {}) {
  fake = fakeSupabase({ confirmarCorreo });
  usarClientePrueba(fake.cliente as unknown as SupabaseClient);
  const router = createMemoryRouter([
    {
      path: "/",
      element: <Layout />,
      children: [
        { index: true, element: <Resumen /> },
        { path: "movimientos", element: <Movimientos /> },
        { path: "ajustes", element: <Ajustes /> },
      ],
    },
  ]);
  render(
    <Provider store={makeStore()}>
      <App router={router} local={local} />
    </Provider>,
  );
  return { router, local };
}

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://prueba.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "llave-publica");
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  usarClientePrueba(null);
});

/** La app ya abrió (se ve el botón de nuevo movimiento). */
const enApp = () => screen.findAllByRole("button", { name: /Nuevo movimiento/ }, { timeout: 3000 });
const pantallaEntrar = () => screen.findByRole("heading", { name: "Qué bueno verte" });

const escribir = async (etiqueta: RegExp, texto: string) => {
  const campo = screen.getByLabelText(etiqueta);
  await userEvent.clear(campo);
  await userEvent.type(campo, texto);
};

describe("cuentas con Supabase", () => {
  it("sin sesión muestra entrar o crear cuenta", async () => {
    montar();
    expect(await screen.findByRole("heading", { name: "Qué bueno verte" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar sin cuenta" })).toBeInTheDocument();
  });

  it("crear cuenta abre la app y guarda los datos en la cuenta", async () => {
    montar();
    await userEvent.click(await screen.findByRole("tab", { name: "Crear cuenta" }));
    await escribir(/Tu nombre/, "Orlando");
    await escribir(/^Correo/, "orlando@correo.co");
    await escribir(/^Contraseña$/, "Cuadre2026!");
    expect(screen.getByText("Muy segura")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect((await enApp()).length).toBeGreaterThan(0);
    // La cuenta nueva arranca con las categorías y cuentas de siempre, guardadas en la base.
    await waitFor(() => expect(fake.tablas.categorias.length).toBeGreaterThan(5));
    expect(fake.tablas.categorias.every((c) => c.user_id === fake.usuarios[0].id)).toBe(true);
    expect(fake.usuarios[0].nombre).toBe("Orlando");

    // Registrar un gasto lo guarda en la base, a nombre de la cuenta.
    await waitFor(() => expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument());
    await userEvent.click(screen.getAllByRole("button", { name: /Nuevo movimiento/ })[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Valor en pesos"), "32500");
    await userEvent.click(within(dialog).getByRole("button", { name: /Domicilios/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar gasto" }));
    await waitFor(() => expect(fake.tablas.movimientos).toHaveLength(1));
    expect(fake.tablas.movimientos[0]).toMatchObject({ user_id: fake.usuarios[0].id, monto: 32500, categoria_id: "domicilios", tipo: "gasto" });
  });

  it("valida los campos antes de crear la cuenta", async () => {
    montar();
    await userEvent.click(await screen.findByRole("tab", { name: "Crear cuenta" }));
    await escribir(/Tu nombre/, "Orlando");
    await escribir(/^Correo/, "orlando@correo");
    await escribir(/^Contraseña$/, "corta");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("Ese correo no parece válido.")).toBeInTheDocument();
    expect(fake.llamadas).not.toContain("signUp");
  });

  it("con confirmación de correo pide abrir el enlace y entra al confirmarlo", async () => {
    montar({ confirmarCorreo: true });
    await userEvent.click(await screen.findByRole("tab", { name: "Crear cuenta" }));
    await escribir(/Tu nombre/, "Ana");
    await escribir(/^Correo/, "ana@correo.co");
    await escribir(/^Contraseña$/, "clave-segura-1");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("heading", { name: "Confirma tu correo" })).toBeInTheDocument();
    expect(screen.getByText("ana@correo.co")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reenviar en/ })).toBeDisabled();

    fake.confirmar("ana@correo.co");
    expect((await enApp()).length).toBeGreaterThan(0);
  });

  it("entrar con contraseña equivocada avisa sin decir cuál falló", async () => {
    montar();
    fake.crearUsuario("orlando@correo.co", "la-buena-123");
    await pantallaEntrar();
    await escribir(/^Correo/, "orlando@correo.co");
    await escribir(/^Contraseña/, "la-mala-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El correo o la contraseña no coinciden.");

    await escribir(/^Contraseña/, "la-buena-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect((await enApp()).length).toBeGreaterThan(0);
  });

  it("recuperar la contraseña manda el enlace y el enlace deja poner una nueva", async () => {
    montar();
    fake.crearUsuario("orlando@correo.co", "vieja-clave-1");
    await userEvent.click(await screen.findByRole("button", { name: "¿La olvidaste?" }));
    await escribir(/^Correo/, "orlando@correo.co");
    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByRole("heading", { name: "Revisa tu correo" })).toBeInTheDocument();
    expect(fake.llamadas).toContain("reset");

    fake.abrirEnlaceRecuperacion("orlando@correo.co");
    expect(await screen.findByRole("heading", { name: "Pon una contraseña nueva" }, { timeout: 3000 })).toBeInTheDocument();
    await escribir(/^Contraseña nueva/, "nueva-clave-2026");
    await escribir(/^Repítela/, "nueva-clave-2026");
    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByRole("heading", { name: "Contraseña actualizada" })).toBeInTheDocument();
    expect(fake.usuarios[0].clave).toBe("nueva-clave-2026");
  });

  it("ofrece pasar a la cuenta lo que había guardado sin cuenta", async () => {
    const local = new LocalRepository(memoryStorage());
    const datos = demoLedger(today());
    datos.transactions = datos.transactions.map((t) => ({ ...t, id: t.id.replace("demo-", "mio-") }));
    await local.replaceAll(datos);
    montar({ local });
    fake.crearUsuario("orlando@correo.co", "la-buena-123", "Orlando");
    await pantallaEntrar();
    await escribir(/^Correo/, "orlando@correo.co");
    await escribir(/^Contraseña/, "la-buena-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: /Hola, Orlando/ }, { timeout: 3000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pasar a mi cuenta" }));
    await waitFor(() => expect(fake.tablas.movimientos).toHaveLength(datos.transactions.length));
    expect((await enApp()).length).toBeGreaterThan(0);
  });

  it("usar sin cuenta sigue funcionando como antes", async () => {
    montar();
    await userEvent.click(await screen.findByRole("button", { name: "Usar sin cuenta" }));
    expect(await screen.findByRole("button", { name: "Ver con datos de ejemplo" })).toBeInTheDocument();
    expect(localStorage.getItem("cuadre:modo")).toBe("local");
  });

  it("cerrar sesión desde Ajustes vuelve a la pantalla de entrar", async () => {
    const { router } = montar();
    fake.crearUsuario("orlando@correo.co", "la-buena-123", "Orlando");
    await pantallaEntrar();
    await escribir(/^Correo/, "orlando@correo.co");
    await escribir(/^Contraseña/, "la-buena-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await enApp();
    await router.navigate("/ajustes");
    const cuenta = await screen.findByRole("region", { name: "Tu cuenta" });
    expect(within(cuenta).getByText("orlando@correo.co")).toBeInTheDocument();
    await userEvent.click(within(cuenta).getByRole("button", { name: "Cerrar sesión" }));
    expect(await screen.findByRole("heading", { name: "Qué bueno verte" })).toBeInTheDocument();
  });

  it("eliminar la cuenta pide escribir el correo y borra todo", async () => {
    const { router } = montar();
    fake.crearUsuario("orlando@correo.co", "la-buena-123", "Orlando");
    await pantallaEntrar();
    await escribir(/^Correo/, "orlando@correo.co");
    await escribir(/^Contraseña/, "la-buena-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await enApp();
    await waitFor(() => expect(fake.tablas.categorias.length).toBeGreaterThan(0));
    await router.navigate("/ajustes");
    const cuenta = await screen.findByRole("region", { name: "Tu cuenta" });
    await userEvent.click(within(cuenta).getByRole("button", { name: "Eliminar" }));
    const boton = within(cuenta).getByRole("button", { name: "Eliminar mi cuenta para siempre" });
    expect(boton).toBeDisabled();
    await userEvent.type(within(cuenta).getByLabelText("Tu correo"), "orlando@correo.co");
    await userEvent.click(boton);
    expect(await screen.findByRole("heading", { name: "Qué bueno verte" })).toBeInTheDocument();
    expect(fake.usuarios).toHaveLength(0);
    expect(fake.tablas.categorias).toHaveLength(0);
  });
});

describe("piezas de las cuentas", () => {
  it("las filas de la base y los tipos de la app van y vuelven sin perder nada", () => {
    const l = demoLedger("2026-10-21");
    const uid = "u1";
    for (const t of l.transactions.slice(0, 20)) expect(desde.movimiento(hacia.movimiento(t, uid) as never)).toEqual(t);
    for (const c of l.categories) expect(desde.categoria(hacia.categoria(c, uid) as never)).toEqual(c);
    for (const g of l.goals) expect(desde.meta(hacia.meta(g, uid) as never)).toEqual({ ...g, createdAt: new Date(g.createdAt).toISOString() });
    for (const b of l.budgets) expect(desde.presupuesto(hacia.presupuesto(b, uid) as never)).toEqual(b);
  });

  it("la base devuelve los montos grandes como texto y se convierten a número", () => {
    const t = desde.movimiento({ id: "1", tipo: "gasto", monto: "1250000", categoria_id: "hogar", cuenta_id: "nequi", fecha: "2026-10-02", nota: "", creado_en: "2026-10-02T12:00:00+00:00" });
    expect(t.amount).toBe(1_250_000);
    expect(t.createdAt).toBe("2026-10-02T12:00:00.000Z");
  });

  it("la fuerza de la contraseña", () => {
    expect(fuerzaClave("abc").nivel).toBe(1);
    expect(fuerzaClave("12345678").nivel).toBe(2);
    expect(fuerzaClave("cuadre2026").nivel).toBe(2);
    expect(fuerzaClave("Cuadre2026").nivel).toBe(3);
    expect(fuerzaClave("Cuadre-2026!").nivel).toBe(4);
  });

  it("traduce los errores de Supabase", () => {
    expect(mensajeAuth({ code: "invalid_credentials" })).toMatch(/no coinciden/);
    expect(mensajeAuth({ status: 429, message: "x" })).toMatch(/muchos intentos/);
    expect(mensajeAuth(new TypeError("Failed to fetch"))).toMatch(/conexión/);
  });
});
