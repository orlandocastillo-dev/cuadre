import { addMonths, monthOf, monthsBetween } from "./dates";
import type { Goal } from "./types";

export interface GoalStatus {
  progress: number;
  left: number;
  /** Mes en que se cumpliría apartando `monthly` cada mes, o null si no se está ahorrando. */
  eta: string | null;
  /** Cuánto hay que apartar al mes para llegar a la fecha límite. */
  neededMonthly: number | null;
  onTrack: boolean | null;
}

export function goalStatus(goal: Goal, monthly: number, todayISO: string): GoalStatus {
  const left = Math.max(0, goal.target - goal.saved);
  const progress = goal.target > 0 ? Math.min(1, goal.saved / goal.target) : 0;
  const current = monthOf(todayISO);
  if (left === 0) return { progress, left, eta: current, neededMonthly: 0, onTrack: true };
  const eta = monthly > 0 ? addMonths(current, Math.ceil(left / monthly)) : null;
  if (!goal.deadline) return { progress, left, eta, neededMonthly: null, onTrack: null };
  const monthsLeft = Math.max(1, monthsBetween(current, monthOf(goal.deadline)));
  // Redondeado a miles hacia arriba: "$191.667" no es una cifra que alguien aparte.
  const neededMonthly = Math.ceil(left / monthsLeft / 1_000) * 1_000;
  return { progress, left, eta, neededMonthly, onTrack: monthly >= neededMonthly };
}
