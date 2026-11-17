"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmModal } from "@/components/confirm";
import { Icon } from "@/components/icons";
import { Card, EmptyState, ErrorMsg, Field, PageHeader, Skeleton, btnCls, btnDanger, fmtDate, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Notice = { id: string; title: string; body: string; createdAt: string; batchId: string | null; batch: { title: string } | null };
type Course = { id: string; title: string };

export default function Notices() {
  const user = useRequireUser("STUDENT", "TEACHER", "ADMIN");
  const [items, setItems] = useState<Notice[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [f, setF] = useState({ title: "", body: "", batchId: "" });
  const [del, setDel] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const admin = user?.role === "ADMIN";
  const load = useCallback(async () => setItems(await api<Notice[]>("/notices")), []);
  useEffect(() => {
    if (!user) return;
    // Initial data fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(e.message));
    if (user.role === "ADMIN") api<Course[]>("/batches").then(setCourses).catch(() => {});
  }, [user, load]);

  if (!user) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ব্যর্থ");
    }
  };

  return (
    <div className="fade-in">
      <PageHeader title="নোটিশ" subtitle={admin ? "সবার জন্য বা নির্দিষ্ট কোর্সের নোটিশ দিন" : undefined} />
      <ErrorMsg error={error} />
      <div className={admin ? "grid gap-6 lg:grid-cols-[1fr_22rem]" : ""}>
        <div className="space-y-3">
          {!items && <Skeleton className="h-28" />}
          {items?.length === 0 && <EmptyState icon="bell" title="কোনো নোটিশ নেই" />}
          {items?.map((n) => (
            <Card key={n.id} className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon name="bell" className="size-4" />
                </span>
                <div>
                  <p className="font-bold">{n.title}</p>
                  <p className="whitespace-pre-wrap text-sm text-sub">{n.body}</p>
                  <p className="mt-1 text-xs text-faint">
                    {n.batch?.title ?? "সবার জন্য"} · {fmtDate(n.createdAt)}
                  </p>
                </div>
              </div>
              {admin && (
                <button className={btnDanger} onClick={() => setDel(n)} aria-label="নোটিশ মুছুন">
                  <Icon name="trash" className="size-4" />
                </button>
              )}
            </Card>
          ))}
        </div>

        {admin && (
          <Card className="h-fit">
            <h2 className="mb-4 font-bold">নতুন নোটিশ</h2>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("/notices", { body: { ...f, batchId: f.batchId || null } });
                  setF({ title: "", body: "", batchId: "" });
                });
              }}
            >
              <Field label="শিরোনাম">{(id) => <input id={id} className={inputCls} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
              <Field label="বিবরণ">{(id) => <textarea id={id} rows={4} className={inputCls} required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
              <Field label="কাদের জন্য">
                {(id) => (
                  <select id={id} className={inputCls} value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })}>
                    <option value="">সবার জন্য</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <button className={`${btnCls} w-full`}>নোটিশ দিন</button>
            </form>
          </Card>
        )}
      </div>
      <ConfirmModal open={!!del} title="নোটিশ মুছবেন?" message={`“${del?.title}” মুছে ফেলা হবে।`} confirmLabel="মুছুন" onConfirm={() => del && run(() => api(`/notices/${del.id}`, { method: "DELETE" }))} onClose={() => setDel(null)} />
    </div>
  );
}
