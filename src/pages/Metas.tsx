import { useMemo, useState, type FormEvent } from "react";
import { useLedger, useMoney, useToday } from "../app/hooks";
import { Icon } from "../components/Icon";
import { useDeleteGoalMutation, useSaveGoalMutation, useSaveTransactionMutation } from "../data/ledgerApi";
import { longMonth, monthOf, today } from "../domain/dates";
import { goalStatus } from "../domain/goals";
import { averageSaved } from "../domain/insights";
import { parseAmount } from "../domain/money";
import type { Goal } from "../domain/types";

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `g-${Date.now()}`;
}

export function Metas() {
  const { ledger } = useLedger();
  const money = useMoney();
  const todayISO = useToday();
  const monthly = useMemo(() => averageSaved(ledger, monthOf(todayISO)), [ledger, todayISO]);
  const [adding, setAdding] = useState(false);
  const totalSaved = ledger.goals.reduce((s, g) => s + g.saved, 0);

  return (
    <div className="page page--narrow">
      <header className="title-row">
        <h1>Metas de ahorro</h1>
        <p className="muted">
          {ledger.goals.length
            ? `Llevas ${money(totalSaved)} reunidos. ${monthly > 0 ? `En los últimos meses has apartado ${money(Math.round(monthly))} al mes en promedio.` : ""}`
            : "Ponle nombre y valor a lo que quieres lograr. Cada abono queda registrado como ahorro."}
        </p>
      </header>

      {ledger.goals.length > 0 && (
        <ul className="goals">
          {ledger.goals.map((g) => (
            <GoalRow key={g.id} goal={g} monthly={monthly} money={money} />
          ))}
        </ul>
      )}

      {adding ? (
        <GoalForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Nueva meta
        </button>
      )}
    </div>
  );
}

function GoalRow({ goal, monthly, money }: { goal: Goal; monthly: number; money: (n: number) => string }) {
  const todayISO = useToday();
  const s = goalStatus(goal, monthly, todayISO);
  const [save] = useSaveGoalMutation();
  const [remove] = useDeleteGoalMutation();
  const [saveTx] = useSaveTransactionMutation();
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);

  const contribute = async (e: FormEvent) => {
    e.preventDefault();
    const n = parseAmount(amount);
    if (!n || n <= 0) return;
    await save({ ...goal, saved: goal.saved + n });
    // El abono también es un movimiento: así aparece en el resumen del mes como ahorro.
    await saveTx({
      id: newId(),
      kind: "gasto",
      amount: n,
      categoryId: "ahorro",
      accountId: "nequi",
      date: todayISO,
      note: `Abono a ${goal.name}`,
      createdAt: new Date().toISOString(),
    });
    setAmount("");
    setOpen(false);
  };

  return (
    <li className="goal">
      <div className="goal__top">
        <h2 className="goal__name">{goal.name}</h2>
        <p className="goal__amounts">
          <strong>{money(goal.saved)}</strong> <span className="muted">de {money(goal.target)}</span>
        </p>
      </div>
      <div className="goal__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progress * 100)} aria-label={`Avance de ${goal.name}`}>
        <span style={{ width: `${s.progress * 100}%` }} />
      </div>
      <p className="goal__note">
        {s.left === 0
          ? "Meta cumplida."
          : s.neededMonthly !== null
            ? `Para ${longMonth(monthOf(goal.deadline!))} necesitas ${money(s.neededMonthly)} al mes. ${s.onTrack ? "Al ritmo que vas, llegas." : s.eta ? `Al ritmo actual llegarías en ${longMonth(s.eta)}.` : ""}`
            : s.eta
              ? `Te faltan ${money(s.left)}. Al ritmo actual la cumples en ${longMonth(s.eta)}.`
              : `Te faltan ${money(s.left)}.`}
      </p>
      <div className="goal__actions">
        {open ? (
          <form className="inline-form" onSubmit={contribute}>
            <label className="sr-only" htmlFor={`ab-${goal.id}`}>
              Valor del abono
            </label>
            <input id={`ab-${goal.id}`} inputMode="decimal" placeholder="50.000" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            <button type="submit" className="btn btn--primary btn--small">
              Abonar
            </button>
            <button type="button" className="btn btn--small btn--quiet" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <>
            <button type="button" className="btn btn--small" onClick={() => setOpen(true)} disabled={s.left === 0}>
              Abonar
            </button>
            <button type="button" className="btn btn--small btn--quiet" onClick={() => remove(goal.id)}>
              Eliminar
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function GoalForm({ onDone }: { onDone: () => void }) {
  const [save] = useSaveGoalMutation();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = parseAmount(target);
    if (name.trim().length < 2) return setError("Ponle un nombre a la meta.");
    if (!t || t <= 0) return setError("Escribe cuánto quieres reunir.");
    await save({ id: newId(), name: name.trim(), target: t, saved: Math.max(0, parseAmount(saved) ?? 0), deadline: deadline ? `${deadline}-28` : undefined, createdAt: new Date().toISOString() });
    onDone();
  };

  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <h2 className="panel__title">Nueva meta</h2>
      <label className="field">
        <span className="field__label">¿Para qué?</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Viaje, guitarra, fondo de emergencia" autoFocus />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field__label">Valor de la meta</span>
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="2.000.000" />
        </label>
        <label className="field">
          <span className="field__label">Ya tengo</span>
          <input inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="0" />
        </label>
        <label className="field">
          <span className="field__label">Para (opcional)</span>
          <input type="month" value={deadline} onChange={(e) => setDeadline(e.target.value)} min={monthOf(today())} />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="button" className="btn btn--quiet" onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary">
          Crear meta
        </button>
      </div>
    </form>
  );
}
