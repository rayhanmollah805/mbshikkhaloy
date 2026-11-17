"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmModal } from "@/components/confirm";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, ErrorMsg, Field, PageHeader, Skeleton, bn, btnCls, btnDanger, btnGhost, fmtDay, inputCls, taka } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Coupon = { id: string; code: string; percent: number; amount: number; maxUses: number | null; used: number; expiresAt: string | null; batchId: string | null; active: boolean };
type Batch = { id: string; title: string };
const blank = { code: "", kind: "percent", value: "", maxUses: "", expiresAt: "", batchId: "" };

export default function Coupons() {
  const user = useRequireUser("ADMIN");
  const [rows, setRows] = useState<Coupon[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [del, setDel] = useState<Coupon | null>(null);
  const load = useCallback(() => api<Coupon[]>("/coupons").then(setRows).catch((e) => setError(e.message)), []);
  useEffect(() => {
    if (!user) return;
    load(); // eslint-disable-line react-hooks/set-state-in-effect
    api<Batch[]>("/batches").then(setBatches).catch(() => undefined);
  }, [user, load]);
  if (!user) return null;
  const act = (fn: () => Promise<unknown>) => {
    setError(null);
    return fn().then(load).catch((e) => setError(e.message));
  };
  return (
    <div className="fade-in">
      <PageHeader title="কুপন ও ডিসকাউন্ট" subtitle="ভর্তির সময় শিক্ষার্থী কোড দিলে ফি কমে যাবে" />
      <ErrorMsg error={error} />
      <Card className="mb-6 max-w-2xl">
        <h2 className="mb-3 font-bold">নতুন কুপন</h2>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await api("/coupons", { body: { code: f.code, percent: f.kind === "percent" ? Number(f.value) : 0, amount: f.kind === "amount" ? Number(f.value) : 0, maxUses: f.maxUses || undefined, expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : undefined, batchId: f.batchId || undefined } });
              setF(blank);
            });
          }}
        >
          <Field label="কোড" hint="ইংরেজি অক্ষর/সংখ্যা, যেমন EID25">{(i) => <input id={i} className={`${inputCls} font-mono uppercase`} required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}</Field>
          <Field label="ছাড়ের ধরন">
            {(i) => (
              <select id={i} className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option value="percent">শতাংশ (%)</option>
                <option value="amount">নির্দিষ্ট টাকা (৳)</option>
              </select>
            )}
          </Field>
          <Field label={f.kind === "percent" ? "ছাড় (%)" : "ছাড় (৳)"} hint={f.kind === "percent" ? "১০০ দিলে কোর্স ফ্রি" : undefined}>{(i) => <input id={i} className={inputCls} type="number" min={1} max={f.kind === "percent" ? 100 : undefined} required value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />}</Field>
          <Field label="কতবার ব্যবহার করা যাবে (ঐচ্ছিক)">{(i) => <input id={i} className={inputCls} type="number" min={1} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} />}</Field>
          <Field label="মেয়াদ (ঐচ্ছিক)">{(i) => <input id={i} className={inputCls} type="datetime-local" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />}</Field>
          <Field label="কোন কোর্সে">
            {(i) => (
              <select id={i} className={inputCls} value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })}>
                <option value="">সব কোর্সে</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
            )}
          </Field>
          <div className="sm:col-span-2">
            <button className={btnCls}>কুপন তৈরি করুন</button>
          </div>
        </form>
      </Card>
      {!rows && !error && <Skeleton className="h-32" />}
      {rows?.length === 0 && <EmptyState icon="taka" title="কোনো কুপন নেই" />}
      <div className="space-y-3">
        {rows?.map((c) => {
          const dead = !c.active || (c.expiresAt && new Date(c.expiresAt) < new Date()) || (c.maxUses !== null && c.used >= c.maxUses);
          return (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-bold">
                  <span className="font-mono text-base">{c.code}</span> <Badge tone="amber">{c.percent ? `${bn(c.percent)}% ছাড়` : `${taka(c.amount)} ছাড়`}</Badge> {dead ? <Badge tone="slate">অচল</Badge> : <Badge tone="green">চালু</Badge>}
                </p>
                <p className="text-sub">
                  ব্যবহার {bn(c.used)}{c.maxUses !== null ? `/${bn(c.maxUses)}` : ""} · {c.expiresAt ? `মেয়াদ ${fmtDay(c.expiresAt)}` : "মেয়াদ নেই"} · {c.batchId ? batches.find((b) => b.id === c.batchId)?.title ?? "নির্দিষ্ট কোর্স" : "সব কোর্স"}
                </p>
              </div>
              <div className="flex gap-2">
                <button className={btnGhost} onClick={() => act(() => api(`/coupons/${c.id}`, { method: "PATCH", body: { active: !c.active } }))}>{c.active ? "বন্ধ করুন" : "চালু করুন"}</button>
                <button className={btnDanger} aria-label="মুছুন" onClick={() => setDel(c)}>
                  <Icon name="trash" className="size-4" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <ConfirmModal open={!!del} title="কুপন মুছবেন?" message={`“${del?.code}” মুছে ফেলা হবে।`} confirmLabel="মুছুন" onConfirm={() => del && act(() => api(`/coupons/${del.id}`, { method: "DELETE" }))} onClose={() => setDel(null)} />
    </div>
  );
}
