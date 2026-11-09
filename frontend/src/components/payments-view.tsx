"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar, Badge, Card, EmptyState, ErrorMsg, PageHeader, Skeleton, btnCls, btnDanger, fmtDate, taka } from "./ui";
import { api } from "@/lib/api";

type Pending = {
  id: string;
  amount: number;
  method: string;
  trxId: string;
  createdAt: string;
  enrollment: { user: { name: string; email: string; phone: string | null }; batch: { id: string; title: string } };
};

/** Pending manual payments (bKash/Nagad TrxID) awaiting approval. */
export function PaymentsView() {
  const [rows, setRows] = useState<Pending[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => api<Pending[]>("/payments/pending").then(setRows), []);
  useEffect(() => {
    // Initial data fetch on mount.
     
    load().catch((e) => setError(e.message));
  }, [load]);

  async function decide(id: string, ok: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/payments/${id}/${ok ? "approve" : "reject"}`, { body: {} });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ব্যর্থ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader title="পেমেন্ট অনুমোদন" subtitle="শিক্ষার্থীর পাঠানো Transaction ID মিলিয়ে অনুমোদন দিন" />
      <ErrorMsg error={error} />
      {!rows && <Skeleton className="h-32" />}
      {rows?.length === 0 && <EmptyState icon="check" title="কোনো পেন্ডিং পেমেন্ট নেই" hint="নতুন পেমেন্ট এলে এখানে দেখা যাবে।" />}
      <div className="space-y-3">
        {rows?.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={p.enrollment.user.name} />
              <div className="min-w-0 text-sm">
                <p className="font-bold">
                  {p.enrollment.user.name} <span className="font-normal text-sub">· {p.enrollment.batch.title}</span>
                </p>
                <p className="text-sub">
                  <Badge tone="amber">{taka(p.amount)}</Badge> {p.method} · TrxID: <span className="font-mono text-ink">{p.trxId}</span>
                </p>
                <p className="text-xs text-faint">
                  {p.enrollment.user.phone ?? p.enrollment.user.email} · {fmtDate(p.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className={btnCls} disabled={busyId === p.id} onClick={() => decide(p.id, true)}>
                অনুমোদন
              </button>
              <button className={btnDanger} disabled={busyId === p.id} onClick={() => decide(p.id, false)}>
                বাতিল
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
