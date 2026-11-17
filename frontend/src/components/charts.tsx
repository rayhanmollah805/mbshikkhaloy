"use client";

import { useEffect, useRef, useState } from "react";
import { bn, fmtDay } from "./ui";

// Chart tokens. Single-series charts use the brand teal; status colors are
// reserved for state and always paired with a text label + count.
const INK = "#0f766e";
const GRID = "#e6ecee";
const AXIS = "#64748b";
const SURFACE = "#ffffff";

type Point = { date: string; value: number };

/** Daily time series: area + 2px line, recessive grid, crosshair + tooltip. */
export function LineChart({
  data,
  format = bn,
  label,
}: {
  data: Point[];
  format?: (n: number) => string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real pixel width so axis text stays crisp at 12px.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 220;
  const P = { l: 52, r: 12, t: 12, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.value));
  // "Nice" axis: a round step (1, 2, 5 x 10^n; never below 1 since these are counts/amounts)
  // so labels never repeat after rounding.
  const rough = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((c) => c >= rough) ?? 10 * mag);
  const top = Math.ceil(max / step) * step;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => P.t + (1 - v / top) * (H - P.t - P.b);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelAt = [0, Math.floor(data.length / 2), data.length - 1];

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  }

  const h = hover === null ? null : data[hover];
  return (
    <div className="relative" ref={box}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className="block touch-pan-y"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize={12} fill={AXIS}>
              {format(Math.round(t))}
            </text>
          </g>
        ))}
        {labelAt.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            fontSize={12}
            fill={AXIS}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          >
            {new Date(data[i].date).toLocaleDateString("bn-BD", { day: "numeric", month: "short" })}
          </text>
        ))}
        <path d={area} fill={INK} opacity={0.1} />
        <path d={line} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke={AXIS} strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.value)} r={5} fill={INK} stroke={SURFACE} strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && h && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs shadow-md"
          style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}
        >
          <p className="text-faint">{fmtDay(h.date)}</p>
          <p className="text-sm font-bold text-ink">{format(h.value)}</p>
        </div>
      )}
      {/* Table view for assistive tech. The wrapper div (not the table) carries sr-only: a table ignores clip/overflow and would stretch the page. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <th>{d.date}</th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Ranked horizontal bars, one hue, value printed at the bar end. */
export function BarList({
  rows,
  unit = "জন",
  empty = "কোনো তথ্য নেই",
}: {
  rows: { id: string; label: string; value: number }[];
  unit?: string;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-faint">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="group" title={`${r.label}: ${bn(r.value)} ${unit}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink">{r.label}</span>
            <span className="shrink-0 font-bold text-ink">
              {bn(r.value)} <span className="font-normal text-faint">{unit}</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-canvas">
            <div
              className="h-full rounded-full bg-brand transition-all group-hover:bg-brand-dark"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Thin segmented bar with a text legend (never color alone). */
export function SegBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-canvas"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}
      >
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <div
                key={p.label}
                title={`${p.label}: ${bn(p.value)}`}
                style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
                className="first:rounded-l-full last:rounded-r-full"
              />
            ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-sub">
            <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
            {p.label}
            <b className="text-ink">{bn(p.value)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
