"use client";

import { useCallback, useEffect, useState } from "react";
import { CourseCard, type Course } from "@/components/course-card";
import { Badge, EmptyState, ErrorMsg, Field, Modal, PageHeader, Skeleton, btnCls, btnGhost, inputCls, taka } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

export default function Browse() {
  const user = useRequireUser("STUDENT");
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [payFor, setPayFor] = useState<Course | null>(null);
  const [pay, setPay] = useState({ method: "bKash", trxId: "" });
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all = await api<Course[]>("/batches");
    setCourses(all.filter((c) => c.enrollment?.status !== "ACTIVE"));
  }, []);
  useEffect(() => {
    if (!user) return;
    // Initial data fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(e.message));
  }, [user, load]);

  if (!user) return null;

  async function enroll(c: Course, body: object = {}) {
    setError(null);
    setModalError(null);
    try {
      await api(`/batches/${c.id}/enroll`, { body });
      setPayFor(null);
      setPay({ method: "bKash", trxId: "" });
      await load();
    } catch (e) {
      const m = e instanceof Error ? e.message : "ব্যর্থ";
      if (payFor) setModalError(m);
      else setError(m);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader title="কোর্সে ভর্তি" subtitle="ফ্রি কোর্সে সাথে সাথে ভর্তি হওয়া যায়। পেইড কোর্সে পেমেন্ট যাচাইয়ের পর শুরু হয়।" />
      <ErrorMsg error={error} />
      {!courses && <Skeleton className="h-48" />}
      {courses?.length === 0 && <EmptyState icon="check" title="সব কোর্সেই ভর্তি আছেন" hint="নতুন কোর্স এলে এখানে দেখা যাবে।" />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses?.map((c) => (
          <CourseCard
            key={c.id}
            course={c}
            action={
              c.enrollment?.status === "PENDING" ? (
                <Badge tone="amber">পেমেন্ট যাচাই চলছে</Badge>
              ) : (
                <div>
                  {c.enrollment?.status === "REJECTED" && <p className="mb-2 text-xs text-danger">আগের পেমেন্ট বাতিল হয়েছে। আবার চেষ্টা করুন।</p>}
                  <button
                    className={btnCls}
                    onClick={() => {
                      if (c.isPaid) {
                        setModalError(null);
                        setPayFor(c);
                      } else enroll(c);
                    }}
                  >
                    {c.isPaid ? `ভর্তি হন · ${taka(c.fee)}` : "ফ্রিতে ভর্তি হন"}
                  </button>
                </div>
              )
            }
          />
        ))}
      </div>

      <Modal open={!!payFor} title={payFor ? `${payFor.title} — ${taka(payFor.fee)}` : ""} onClose={() => setPayFor(null)}>
        {payFor && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              enroll(payFor, pay);
            }}
          >
            <p className="text-sm text-sub">নির্ধারিত নম্বরে টাকা পাঠিয়ে মেথড ও Transaction ID দিন। শিক্ষক/অ্যাডমিন যাচাই করলে কোর্স খুলে যাবে।</p>
            <Field label="পেমেন্ট মেথড">
              {(id) => (
                <select id={id} className={inputCls} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                  <option>bKash</option>
                  <option>Nagad</option>
                  <option>Rocket</option>
                  <option>Bank</option>
                </select>
              )}
            </Field>
            <Field label="Transaction ID">{(id) => <input id={id} className={inputCls} required value={pay.trxId} onChange={(e) => setPay({ ...pay, trxId: e.target.value })} />}</Field>
            <ErrorMsg error={modalError} />
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setPayFor(null)}>
                বাতিল
              </button>
              <button className={btnCls}>জমা দিন</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
