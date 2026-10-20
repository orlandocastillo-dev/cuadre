import { useMonth, useToday } from "../app/hooks";
import { addMonths, monthLabel, monthOf } from "../domain/dates";
import { Icon } from "./Icon";

export function MonthSwitcher() {
  const [month, setMonth] = useMonth();
  const current = monthOf(useToday());
  const label = monthLabel(month);
  return (
    <div className="month" role="group" aria-label="Mes">
      <button type="button" className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">
        <Icon name="left" />
      </button>
      <span className="month__label" aria-live="polite">
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </span>
      <button type="button" className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= current} aria-label="Mes siguiente">
        <Icon name="right" />
      </button>
      {month !== current && (
        <button type="button" className="link month__today" onClick={() => setMonth(current)}>
          Volver a este mes
        </button>
      )}
    </div>
  );
}
