"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarList, LineChart, SegBar } from "@/components/charts";
import { Card, ErrorMsg, PageHeader, Skeleton, StatCard, bn, taka } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Stats = {
  totals: {
    students: number;
    teachers: number;
    batches: number;
    activeEnrollments: number;
    pendingPayments: number;
    exams: number;
    attempts: number;
    revenue: number;
  };
  signups: { date: string; value: number }[];
  revenueByDay: { date: string; value: number }[];
  payments: { APPROVED: number; PENDING: number; REJECTED: number };
  batches: { id: string; title: string; isPaid: boolean; students: number }[];
};

export default function AdminDashboard() {
  const user = useRequireUser("ADMIN");
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Stats>("/admin/stats")
      .then(setS)
      .catch((e) => setError(e.message));
  }, [user]);

  if (!user) return null;
  const sum = (a: { value: number }[]) => a.reduce((t, x) => t + x.value, 0);

  return (
    <div className="fade-in">
      <PageHeader title="অ্যাডমিন ড্যাশবোর্ড" subtitle="পুরো প্ল্যাটফর্মের সারসংক্ষেপ" />
      <ErrorMsg error={error} />
      {!s && !error && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      {s && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon="users" label="মোট শিক্ষার্থী" value={bn(s.totals.students)} />
            <StatCard icon="teacher" label="সক্রিয় শিক্ষক" value={bn(s.totals.teachers)} tone="slate" />
            <StatCard icon="book" label="কোর্স" value={bn(s.totals.batches)} hint={`${bn(s.totals.activeEnrollments)} টি সক্রিয় ভর্তি`} tone="green" />
            <StatCard icon="taka" label="মোট আয়" value={taka(s.totals.revenue)} tone="amber" hint="অনুমোদিত পেমেন্ট" />
          </div>

          {s.totals.pendingPayments > 0 && (
            <Link
              href="/admin/payments"
              className="flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft px-5 py-3 transition-colors hover:border-accent"
            >
              <span className="flex items-center gap-3 font-medium text-warn">
                <span className="grid size-8 place-items-center rounded-full bg-accent/15 font-bold">{bn(s.totals.pendingPayments)}</span>
                টি পেমেন্ট অনুমোদনের অপেক্ষায়
              </span>
              <span className="text-sm font-semibold text-warn">দেখুন →</span>
            </Link>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-bold">নতুন শিক্ষার্থী</h2>
                <span className="text-sm text-faint">শেষ ৩০ দিন · মোট {bn(sum(s.signups))}</span>
              </div>
              <LineChart data={s.signups} label="গত ৩০ দিনে প্রতিদিনের নতুন শিক্ষার্থী" />
            </Card>
            <Card>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-bold">আয়</h2>
                <span className="text-sm text-faint">শেষ ৩০ দিন · মোট {taka(sum(s.revenueByDay))}</span>
              </div>
              <LineChart data={s.revenueByDay} format={taka} label="গত ৩০ দিনে প্রতিদিনের আয়" />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <h2 className="mb-4 font-bold">কোর্স অনুযায়ী সক্রিয় শিক্ষার্থী</h2>
              <BarList rows={s.batches.slice(0, 8).map((b) => ({ id: b.id, label: b.title, value: b.students }))} empty="এখনো কোনো কোর্স নেই" />
            </Card>
            <div className="space-y-6">
              <Card>
                <h2 className="mb-4 font-bold">পেমেন্টের অবস্থা</h2>
                <SegBar
                  parts={[
                    { label: "অনুমোদিত", value: s.payments.APPROVED, color: "#15803d" },
                    { label: "অপেক্ষমাণ", value: s.payments.PENDING, color: "#d97706" },
                    { label: "বাতিল", value: s.payments.REJECTED, color: "#b91c1c" },
                  ]}
                />
              </Card>
              <Card>
                <h2 className="mb-3 font-bold">পরীক্ষা</h2>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-canvas p-3">
                    <p className="text-2xl font-bold">{bn(s.totals.exams)}</p>
                    <p className="text-xs text-sub">পরীক্ষা</p>
                  </div>
                  <div className="rounded-lg bg-canvas p-3">
                    <p className="text-2xl font-bold">{bn(s.totals.attempts)}</p>
                    <p className="text-xs text-sub">জমা পড়েছে</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
