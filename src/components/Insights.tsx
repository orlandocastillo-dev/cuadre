import { useAppSelector } from "../app/hooks";
import type { Insight, Tone } from "../domain/insights";
import { Icon } from "./Icon";

const TONE: Record<Tone, { label: string; icon: string }> = {
  alerta: { label: "Atención", icon: "alert" },
  aviso: { label: "Ojo", icon: "gauge" },
  dato: { label: "Para saber", icon: "dots" },
  bien: { label: "Bien", icon: "check" },
};

/** Las recomendaciones del mes, de la más urgente a la mejor noticia. */
export function Insights({ items, limit }: { items: Insight[]; limit?: number }) {
  const hide = useAppSelector((s) => s.prefs.hideAmounts);
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) {
    return <p className="muted">Todavía no hay nada que señalar. Las recomendaciones aparecen cuando registras movimientos de al menos un mes.</p>;
  }
  return (
    <ul className="insights">
      {shown.map((i) => (
        <li key={i.id} className={`insight insight--${i.tone}`}>
          <span className="insight__icon" aria-hidden="true">
            <Icon name={TONE[i.tone].icon} size={16} />
          </span>
          <div>
            <p className="insight__title">
              <span className="sr-only">{TONE[i.tone].label}: </span>
              {i.title}
            </p>
            <p className="insight__detail">{hide ? i.detail.replace(/\$[\d.]+/g, "$ •••") : i.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
