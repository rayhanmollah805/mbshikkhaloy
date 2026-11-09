"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Avatar, Badge, Card, EmptyState, ErrorMsg, PageHeader, Skeleton, bn, btnGhost, fmtDay, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Student = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { enrollments: number };
};

export default function AdminStudents() {
  const user = useRequireUser("ADMIN");
  const [rows, setRows] = useState<Student[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api<Student[]>("/admin/users?role=STUDENT").then(setRows), []);
  useEffect(() => {
    if (!user) return;
    // Initial data fetch on mount.
     
    load().catch((e) => setError(e.message));
  }, [user, load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || `${r.name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(s));
  }, [rows, q]);

  if (!user) return null;

  async function toggle(s: Student) {
    setError(null);
    try {
      await api(`/admin/users/${s.id}`, { method: "PATCH", body: { isActive: !s.isActive } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ব্যর্থ");
    }
  }

  return (
    <div className="fade-in">
      <PageHeader title="শিক্ষার্থী" subtitle={rows ? `মোট ${bn(rows.length)} জন` : undefined} />
      <ErrorMsg error={error} />
      <div className="relative mb-4 max-w-sm">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input className={`${inputCls} pl-9`} placeholder="নাম, ইমেইল বা মোবাইল খুঁজুন" aria-label="শিক্ষার্থী খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!rows && <Skeleton className="h-40" />}
      {rows && shown.length === 0 && <EmptyState icon="users" title="কোনো শিক্ষার্থী পাওয়া যায়নি" />}
      {shown.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-3">শিক্ষার্থী</th>
                <th className="px-4 py-3">মোবাইল</th>
                <th className="px-4 py-3">কোর্স</th>
                <th className="px-4 py-3">যোগ দিয়েছেন</th>
                <th className="px-4 py-3">অবস্থা</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} />
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-sub">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sub">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3">{bn(s._count.enrollments)}</td>
                  <td className="px-4 py-3 text-sub">{fmtDay(s.createdAt)}</td>
                  <td className="px-4 py-3">{s.isActive ? <Badge tone="green">সক্রিয়</Badge> : <Badge tone="red">নিষ্ক্রিয়</Badge>}</td>
                  <td className="px-4 py-3 text-right">
                    <button className={btnGhost} onClick={() => toggle(s)}>
                      {s.isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
