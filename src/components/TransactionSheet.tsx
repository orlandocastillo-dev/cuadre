import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLedger, useToday } from "../app/hooks";
import { useDeleteTransactionMutation, useSaveTransactionMutation } from "../data/ledgerApi";
import { addDays, today } from "../domain/dates";
import { cop, parseAmount } from "../domain/money";
import type { Kind, Transaction } from "../domain/types";
import { Icon } from "./Icon";

interface Props {
  open: boolean;
  edit?: Transaction;
  kind?: Kind;
  categoryId?: string;
  onClose: () => void;
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Formulario para registrar o editar un movimiento
export function TransactionSheet({ open, edit, kind: initialKind, categoryId: initialCategory, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { ledger } = useLedger();
  const [save, saving] = useSaveTransactionMutation();
  const [remove] = useDeleteTransactionMutation();

  const [kind, setKind] = useState<Kind>(edit?.kind ?? initialKind ?? "gasto");
  const [amount, setAmount] = useState(edit ? edit.amount.toLocaleString("es-CO") : "");
  const [categoryId, setCategoryId] = useState(edit?.categoryId ?? initialCategory ?? "");
  const [accountId, setAccountId] = useState(edit?.accountId ?? lastAccount(ledger.transactions) ?? "nequi");
  const [date, setDate] = useState(edit?.date ?? today());
  const [note, setNote] = useState(edit?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    // jsdom y algunos navegadores viejos no tienen showModal: entonces se abre como diálogo normal.
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }
    if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);

  // Las que más usas quedan arriba, al alcance del pulgar.
  const categories = useMemo(() => {
    const usos = new Map<string, number>();
    for (const tx of ledger.transactions) usos.set(tx.categoryId, (usos.get(tx.categoryId) ?? 0) + 1);
    return ledger.categories.filter((c) => c.kind === kind).sort((a, b) => (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0));
  }, [ledger.categories, ledger.transactions, kind]);
  const parsed = parseAmount(amount);
  const todayISO = useToday();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed || parsed <= 0) return setError("Escribe el valor, por ejemplo 25.000.");
    const cat = categoryId && categories.some((c) => c.id === categoryId) ? categoryId : null;
    if (!cat) return setError("Elige una categoría.");
    const tx: Transaction = {
      id: edit?.id ?? newId(),
      kind,
      amount: Math.abs(parsed),
      categoryId: cat,
      accountId,
      date,
      note: note.trim(),
      createdAt: edit?.createdAt ?? new Date().toISOString(),
    };
    await save(tx);
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="sheet"
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="sheet-title"
    >
      <form className="sheet__body" onSubmit={submit} noValidate>
        <header className="sheet__head">
          <h2 id="sheet-title">{edit ? "Editar movimiento" : "Nuevo movimiento"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>

        <div className="kind" role="group" aria-label="Tipo de movimiento">
          {(["gasto", "ingreso"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              className={`kind__btn kind__btn--${k}`}
              onClick={() => {
                setKind(k);
                setCategoryId("");
              }}
            >
              {k === "gasto" ? "Gasto" : "Ingreso"}
            </button>
          ))}
        </div>

        <div className="amount">
          <span className="amount__sign" aria-hidden="true">
            $
          </span>
          <input
            aria-label="Valor en pesos"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={amount}
            autoFocus={!edit}
            onChange={(e) => {
              const v = e.target.value;
              // Solo números: se escriben los puntos de miles mientras se teclea (25000 → 25.000).
              const digits = v.replace(/\./g, "");
              setAmount(/^\d*$/.test(digits) ? (digits ? Number(digits).toLocaleString("es-CO") : "") : v);
              setError(null);
            }}
          />
        </div>
        <p className="amount__hint" aria-live="polite">
          {parsed && parsed > 0 && !/^[\d.]+$/.test(amount) ? cop(parsed) : " "}
        </p>

        <fieldset className="cats">
          <legend>Categoría</legend>
          <div className="cats__grid">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cat cat--c${c.color}`}
                aria-pressed={categoryId === c.id}
                onClick={() => {
                  setCategoryId(c.id);
                  setError(null);
                }}
              >
                <span className="cat__icon">
                  <Icon name={c.icon} size={18} />
                </span>
                <span className="cat__name">{c.name}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="sheet__row">
          <div className="field">
            <span className="field__label" id="lbl-fecha">
              Fecha
            </span>
            <div className="dates" role="group" aria-labelledby="lbl-fecha">
              <button type="button" aria-pressed={date === todayISO} onClick={() => setDate(todayISO)}>
                Hoy
              </button>
              <button type="button" aria-pressed={date === addDays(todayISO, -1)} onClick={() => setDate(addDays(todayISO, -1))}>
                Ayer
              </button>
              <input type="date" value={date} max={todayISO} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Otra fecha" />
            </div>
          </div>
          <div className="field">
            <span className="field__label" id="lbl-cuenta">
              {kind === "gasto" ? "Pagué con" : "Entró a"}
            </span>
            <div className="seg" role="group" aria-labelledby="lbl-cuenta">
              {ledger.accounts.map((a) => (
                <button key={a.id} type="button" aria-pressed={accountId === a.id} onClick={() => setAccountId(a.id)}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="field">
          <span className="field__label">Nota</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "gasto" ? "Rappi, D1, Netflix…" : "Pago de nómina…"} maxLength={80} />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <footer className="sheet__foot">
          {edit && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={async () => {
                await remove(edit.id);
                onClose();
              }}
            >
              <Icon name="trash" size={18} /> Eliminar
            </button>
          )}
          <button type="submit" className="btn btn--primary btn--grow" disabled={saving.isLoading}>
            {edit ? "Guardar cambios" : kind === "gasto" ? "Registrar gasto" : "Registrar ingreso"}
            {!edit && parsed && parsed > 0 ? <span aria-hidden="true">&nbsp;de {cop(parsed)}</span> : null}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function lastAccount(txs: Transaction[]): string | undefined {
  return [...txs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.accountId;
}
