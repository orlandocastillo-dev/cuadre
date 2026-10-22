import { useState } from "react";
import { useAppSelector } from "../app/hooks";
import { shortMonth } from "../domain/dates";
import { copShort } from "../domain/money";
import type { MonthTotals } from "../domain/summary";

interface Props {
  data: MonthTotals[];
  selected: string;
  onSelect?: (month: string) => void;
}

const W = 640;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 28, left: 52 };

// Ingresos y gastos de los últimos meses, en barras lado a lado
export function TrendChart({ data, selected, onSelect }: Props) {
  const hide = useAppSelector((s) => s.prefs.hideAmounts);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.spending]));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const bar = Math.min(22, slot * 0.28);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const h = (v: number) => (v / top) * innerH;

  const tip = hover !== null ? data[hover] : null;

  return (
    <figure className="chart">
      <div className="chart__legend" aria-hidden="true">
        <span>
          <i className="swatch swatch--in" /> Ingresos
        </span>
        <span>
          <i className="swatch swatch--out" /> Gastos
        </span>
      </div>
      <div className="chart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos y gastos por mes" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart__grid" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="chart__axis">
                {hide ? "" : copShort(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const isSel = d.month === selected;
            return (
              <g key={d.month}>
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  className={`chart__hit ${hover === i ? "is-hover" : ""}`}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => onSelect?.(d.month)}
                />
                <path d={roundedTop(cx - bar - 1, y(d.income), bar, h(d.income))} className="chart__bar chart__bar--in" pointerEvents="none" />
                <path d={roundedTop(cx + 1, y(d.spending), bar, h(d.spending))} className="chart__bar chart__bar--out" pointerEvents="none" />
                <text x={cx} y={H - 8} textAnchor="middle" className={`chart__axis ${isSel ? "is-selected" : ""}`}>
                  {shortMonth(d.month)}
                </text>
              </g>
            );
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="chart__base" />
        </svg>
        {tip && !hide && (
          <div className="chart__tip" style={{ left: `${((PAD.left + slot * hover! + slot / 2) / W) * 100}%` }} role="status">
            <strong>{shortMonth(tip.month)}</strong>
            <span>
              <i className="swatch swatch--in" /> Ingresos {copShort(tip.income)}
            </span>
            <span>
              <i className="swatch swatch--out" /> Gastos {copShort(tip.spending)}
            </span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Ingresos y gastos por mes</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Ingresos</th>
            <th>Gastos</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{shortMonth(d.month)}</td>
              <td>{d.income}</td>
              <td>{d.spending}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Barra con las esquinas de arriba redondeadas (4px) y la base recta sobre el eje. */
function roundedTop(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function niceStep(max: number): number {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}
