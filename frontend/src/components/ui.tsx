"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";

// ---------- class tokens ----------
export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-faint outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-canvas";
export const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50 min-h-10";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50 min-h-9";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-danger/25 bg-surface px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50 min-h-9";

// ---------- formatting ----------
export const DAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
export const bn = (n: number) => n.toLocaleString("bn-BD");
export const taka = (n: number) => `৳${n.toLocaleString("bn-BD")}`;
export const fmtDate = (d: string) =>
  new Date(d).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
export const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString("bn-BD", { dateStyle: "medium" });

// ---------- primitives ----------
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-5 ${className}`}>{children}</div>
  );
}

const tones = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-ok-soft text-ok",
  amber: "bg-warn-soft text-warn",
  red: "bg-danger-soft text-danger",
  brand: "bg-brand-soft text-brand-dark",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function ErrorMsg({ error }: { error: string | null }) {
  return error ? (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
      {error}
    </div>
  ) : null;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: IconName;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-sub">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function StatCard({
  icon,
  label,
  value,
  tone = "brand",
  hint,
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: "brand" | "amber" | "green" | "slate";
  hint?: string;
}) {
  const iconTone = {
    brand: "bg-brand-soft text-brand",
    amber: "bg-accent-soft text-warn",
    green: "bg-ok-soft text-ok",
    slate: "bg-slate-100 text-slate-700",
  }[tone];
  return (
    <Card className="flex items-center gap-4">
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${iconTone}`}>
        <Icon name={icon} className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-sub">{label}</p>
        <p className="text-2xl font-bold leading-tight text-ink">{value}</p>
        {hint && <p className="text-xs text-faint">{hint}</p>}
      </div>
    </Card>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            value === t.key
              ? "border-brand text-brand"
              : "border-transparent text-sub hover:text-ink"
          }`}
        >
          {t.icon && <Icon name={t.icon} className="size-4" />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Accessible modal: Esc / backdrop closes, focus moves in and is restored. */
export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  // Portal to <body> so no ancestor transform/overflow can clip the overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fade-in w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl bg-surface p-6 shadow-xl outline-none`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="rounded-lg p-1.5 text-sub hover:bg-canvas">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
