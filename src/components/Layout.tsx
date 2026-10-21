import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { useCuenta } from "../auth/CuentaContext";
import { prefsChanged } from "../features/prefs";
import type { Kind, Transaction } from "../domain/types";
import { Icon } from "./Icon";
import { SheetContext } from "./sheet";
import { TransactionSheet } from "./TransactionSheet";

const NAV = [
  { to: "/", label: "Resumen", icon: "gauge" },
  { to: "/movimientos", label: "Movimientos", icon: "list" },
  { to: "/presupuestos", label: "Presupuestos", icon: "chart" },
  { to: "/metas", label: "Metas", icon: "target" },
  { to: "/importar", label: "Importar", icon: "upload" },
  { to: "/ajustes", label: "Ajustes", icon: "settings" },
];

/** En el celular: cuatro destinos abajo y el botón de agregar en el centro. */
const TABS = [NAV[0], NAV[1], NAV[2], NAV[3]];

interface SheetState {
  key: number;
  open: boolean;
  edit?: Transaction;
  kind?: Kind;
  categoryId?: string;
}

export function Layout() {
  const { pathname, search } = useLocation();
  const dispatch = useAppDispatch();
  const { theme, hideAmounts } = useAppSelector((s) => s.prefs);
  const [sheet, setSheet] = useState<SheetState>({ key: 0, open: false });
  const { usuario, cerrarSesion } = useCuenta();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") delete root.dataset.theme;
    else root.dataset.theme = theme === "oscuro" ? "dark" : "light";
  }, [theme]);

  const open = useCallback((o: { edit?: Transaction; kind?: Kind; categoryId?: string } = {}) => {
    setSheet((s) => ({ key: s.key + 1, open: true, ...o }));
  }, []);

  // El mes elegido viaja entre secciones.
  const withMonth = (to: string) => {
    const m = new URLSearchParams(search).get("mes");
    return m ? `${to}?mes=${m}` : to;
  };

  return (
    <SheetContext.Provider value={{ open }}>
      <a className="skip" href="#contenido">
        Ir al contenido
      </a>
      <div className="shell">
        <aside className="side">
          <NavLink to="/" className="brand" aria-label="Cuadre, inicio">
            <span className="brand__mark" aria-hidden="true" />
            cuadre
          </NavLink>
          <button type="button" className="btn btn--primary side__add" onClick={() => open()}>
            <Icon name="plus" size={18} /> Nuevo movimiento
          </button>
          <nav aria-label="Principal" className="side__nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={withMonth(n.to)} end={n.to === "/"} className="side__link">
                <Icon name={n.icon} />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="side__privacy" aria-pressed={hideAmounts} onClick={() => dispatch(prefsChanged({ hideAmounts: !hideAmounts }))}>
            <Icon name={hideAmounts ? "eyeOff" : "eye"} size={18} />
            {hideAmounts ? "Mostrar montos" : "Ocultar montos"}
          </button>
          {usuario && (
            <NavLink to="/ajustes" className="side__cuenta" aria-label={`Tu cuenta: ${usuario.nombre}`}>
              <span className="cuenta__avatar" aria-hidden="true">
                {(usuario.nombre || usuario.email).charAt(0).toUpperCase()}
              </span>
              <span>
                {usuario.nombre}
                <small>{usuario.email}</small>
              </span>
            </NavLink>
          )}
          {usuario && (
            <button type="button" className="side__salir" onClick={() => void cerrarSesion()}>
              <Icon name="logout" size={18} /> Cerrar sesión
            </button>
          )}
        </aside>

        <div className="main-col">
          <header className="topbar">
            <NavLink to="/" className="brand" aria-label="Cuadre, inicio">
              <span className="brand__mark" aria-hidden="true" />
              cuadre
            </NavLink>
            <div className="topbar__actions">
              <button type="button" className="icon-btn" aria-pressed={hideAmounts} onClick={() => dispatch(prefsChanged({ hideAmounts: !hideAmounts }))} aria-label={hideAmounts ? "Mostrar montos" : "Ocultar montos"}>
                <Icon name={hideAmounts ? "eyeOff" : "eye"} />
              </button>
              <NavLink to="/importar" className="icon-btn" aria-label="Importar extracto">
                <Icon name="upload" />
              </NavLink>
              <NavLink to="/ajustes" className="icon-btn" aria-label="Ajustes">
                <Icon name="settings" />
              </NavLink>
              {usuario && (
                <button type="button" className="icon-btn" onClick={() => void cerrarSesion()} aria-label="Cerrar sesión" title="Cerrar sesión">
                  <Icon name="logout" />
                </button>
              )}
            </div>
          </header>
          <main id="contenido" className="main">
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="tabs" aria-label="Secciones">
        {TABS.slice(0, 2).map((n) => (
          <NavLink key={n.to} to={withMonth(n.to)} end={n.to === "/"} className="tabs__item">
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button type="button" className="tabs__add" onClick={() => open()} aria-label="Nuevo movimiento">
          <Icon name="plus" size={26} />
        </button>
        {TABS.slice(2).map((n) => (
          <NavLink key={n.to} to={withMonth(n.to)} className="tabs__item">
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <TransactionSheet key={sheet.key} open={sheet.open} edit={sheet.edit} kind={sheet.kind} categoryId={sheet.categoryId} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </SheetContext.Provider>
  );
}
