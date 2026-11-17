"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, EmptyState, ErrorMsg, PageHeader, Skeleton, StatCard, bn, btnGhost, fmtDay, taka } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Due = {
  id: string;
  accessUntil: string;
  overdue: boolean;
  hasPending: boolean;
  user: { name: string; phone: string | null; email: string };
  batch: { id: string; title: string; fee: number };
};

export default function Dues() {
  const user = useRequireUser("ADMIN");
  const [rows, setRows] = useState<Due[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<Due[]>("/dues").then(setRows).catch((e) => setError(e.message)), []);
  useEffect(() => {
    if (user) load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [user, load]);
  if (!user) return null;
  const overdue = rows?.filter((r) => r.overdue) ?? [];
  return (
    <div className="fade-in">
      <PageHeader title="বকেয়া ও মেয়াদ" subtitle="মাসিক কোর্সের শিক্ষার্থী যাদের মেয়াদ শেষ বা ৭ দিনের মধ্যে শেষ হবে" />
      <ErrorMsg error={error} />
      {!rows && !error && <Skeleton className="h-40" />}
      {rows && (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard label="মেয়াদ শেষ" value={bn(overdue.length)} icon="alert" />
          <StatCard label="শিগগির শেষ হবে" value={bn(rows.length - overdue.length)} icon="clock" />
          <StatCard label="বকেয়া ফি (আনুমানিক)" value={taka(overdue.reduce((n, r) => n + r.batch.fee, 0))} icon="taka" />
        </div>
      )}
      {rows?.length === 0 && <EmptyState icon="check" title="কোনো বকেয়া নেই" hint="সব মাসিক শিক্ষার্থীর মেয়াদ চালু আছে।" />}
      <div className="space-y-3">
        {rows?.map((r) => {
          const days = Math.ceil((new Date(r.accessUntil).getTime() - Date.now()) / 864e5);
          return (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-bold">
                  {r.user.name} {r.overdue ? <Badge tone="red">মেয়াদ শেষ ({bn(-days)} দিন আগে)</Badge> : <Badge tone="amber">আর {bn(days)} দিন</Badge>} {r.hasPending && <Badge tone="brand">পেমেন্ট যাচাই বাকি</Badge>}
                </p>
                <p className="text-sub">
                  {r.batch.title} · {taka(r.batch.fee)}/মাস · {fmtDay(r.accessUntil)}
                </p>
                <p className="text-xs text-faint">{r.user.phone ?? r.user.email}</p>
              </div>
              <button className={btnGhost} onClick={() => api(`/batches/${r.batch.id}/students/${r.id}/extend`, { body: { days: 30 } }).then(load).catch((e) => setError(e.message))}>
                +৩০ দিন দিন
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
