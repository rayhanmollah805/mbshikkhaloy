"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, EmptyState, ErrorMsg, PageHeader, Skeleton, bn, btnGhost, fmtDate, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Row = { id: string; actorName: string; action: string; target: string | null; detail: string | null; createdAt: string };

export default function Audit() {
  const user = useRequireUser("ADMIN");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (term: string, skip = 0) =>
      api<{ rows: Row[]; total: number }>(`/admin/audit?q=${encodeURIComponent(term)}&skip=${skip}`)
        .then((r) => {
          setRows((prev) => (skip ? [...(prev ?? []), ...r.rows] : r.rows));
          setTotal(r.total);
          setError(null);
        })
        .catch((e) => setError(e.message)),
    [],
  );
  // Search as you type, with a short pause.
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [user, q, load]);
  if (!user) return null;
  return (
    <div className="fade-in">
      <PageHeader title="অডিট লগ" subtitle="কে কী করেছে — গুরুত্বপূর্ণ কাজের রেকর্ড" />
      <input className={`${inputCls} mb-4 max-w-md`} type="search" placeholder="কাজ, ব্যক্তি বা নাম দিয়ে খুঁজুন…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorMsg error={error} />
      {!rows && !error && <Skeleton className="h-40" />}
      {rows?.length === 0 && <EmptyState icon="clipboard" title="কোনো রেকর্ড নেই" />}
      <div className="space-y-2">
        {rows?.map((r) => (
          <Card key={r.id} className="!py-3 text-sm">
            <p>
              <b>{r.actorName}</b> — {r.action} {r.target && <b className="text-brand">{r.target}</b>}
            </p>
            {r.detail && <p className="text-xs text-sub">{r.detail}</p>}
            <p className="text-xs text-faint">{fmtDate(r.createdAt)}</p>
          </Card>
        ))}
      </div>
      {rows && rows.length < total && (
        <button className={`${btnGhost} mt-4`} onClick={() => load(q, rows.length)}>
          আরও দেখুন ({bn(total - rows.length)}টি বাকি)
        </button>
      )}
    </div>
  );
}
