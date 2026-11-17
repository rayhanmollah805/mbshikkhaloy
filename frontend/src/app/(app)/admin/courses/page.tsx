"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConfirmModal } from "@/components/confirm";
import { Icon } from "@/components/icons";
import {
  Badge,
  Card,
  EmptyState,
  ErrorMsg,
  Field,
  Modal,
  PageHeader,
  Skeleton,
  bn,
  btnCls,
  btnDanger,
  btnGhost,
  inputCls,
  taka,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Course = {
  id: string;
  title: string;
  description: string | null;
  isPaid: boolean;
  fee: number;
  billing?: "ONCE" | "MONTHLY";
  slug?: string | null;
  isActive: boolean;
  subtitle: string | null;
  duration: string | null;
  highlights: string[];
  _count: { enrollments: number };
  teachers: { id: string; name: string }[];
};
type Teacher = { id: string; name: string; email: string; isActive: boolean };

const blank = { title: "", subtitle: "", description: "", duration: "", highlights: "", isPaid: false, fee: "", billing: "ONCE", slug: "" };

export default function AdminCourses() {
  const user = useRequireUser("ADMIN");
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string | null; f: typeof blank } | null>(null);
  const [assign, setAssign] = useState<{ course: Course; ids: Set<string> } | null>(null);
  const [del, setDel] = useState<Course | null>(null);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([api<Course[]>("/batches"), api<Teacher[]>("/admin/users?role=TEACHER")]);
    setCourses(c);
    setTeachers(t.filter((x) => x.isActive));
  }, []);
  useEffect(() => {
    if (!user) return;
    // Initial data fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(e.message));
  }, [user, load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ব্যর্থ");
    }
  };

  if (!user) return null;

  return (
    <div className="fade-in">
      <PageHeader
        title="কোর্স"
        subtitle="কোর্স তৈরি করুন, ফি ঠিক করুন এবং শিক্ষক অ্যাসাইন করুন"
        action={
          <button className={btnCls} onClick={() => setEdit({ id: null, f: blank })}>
            <Icon name="plus" className="size-4" /> নতুন কোর্স
          </button>
        }
      />
      <ErrorMsg error={error} />
      {!courses && <Skeleton className="h-40" />}
      {courses?.length === 0 && <EmptyState icon="book" title="এখনো কোনো কোর্স নেই" hint="“নতুন কোর্স” চেপে প্রথম কোর্সটি তৈরি করুন।" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {courses?.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{c.title}</h2>
                <p className="line-clamp-2 text-sm text-sub">{c.description || "বিবরণ নেই"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {c.isPaid ? <Badge tone="amber">{taka(c.fee)}</Badge> : <Badge tone="green">ফ্রি</Badge>}
                {!c.isActive && <Badge tone="slate">ভর্তি বন্ধ</Badge>}
              </div>
            </div>
            <div className="my-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-sub">
              <span className="flex items-center gap-1.5">
                <Icon name="users" className="size-4" /> {bn(c._count.enrollments)} জন
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Icon name="teacher" className="size-4" />
                {c.teachers.length === 0 ? (
                  <span className="text-warn">কোনো শিক্ষক নেই</span>
                ) : (
                  c.teachers.map((t) => (
                    <span key={t.id} className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink">
                      {t.name}
                    </span>
                  ))
                )}
              </span>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Link href={`/batches/${c.id}`} className={btnCls}>
                খুলুন
              </Link>
              <button className={btnGhost} onClick={() => setAssign({ course: c, ids: new Set(c.teachers.map((t) => t.id)) })}>
                <Icon name="teacher" className="size-4" /> শিক্ষক
              </button>
              <button
                className={btnGhost}
                onClick={() => setEdit({ id: c.id, f: { title: c.title, subtitle: c.subtitle ?? "", description: c.description ?? "", duration: c.duration ?? "", highlights: c.highlights.join("\n"), isPaid: c.isPaid, fee: c.isPaid ? String(c.fee) : "", billing: c.billing ?? "ONCE", slug: c.slug ?? "" } })}
              >
                <Icon name="edit" className="size-4" /> এডিট
              </button>
              <button className={btnGhost} onClick={() => run(() => api(`/batches/${c.id}`, { method: "PATCH", body: { isActive: !c.isActive } }))}>
                {c.isActive ? "ভর্তি বন্ধ" : "ভর্তি চালু"}
              </button>
              <button className={btnDanger} onClick={() => setDel(c)} aria-label={`${c.title} মুছুন`}>
                <Icon name="trash" className="size-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* create / edit */}
      <Modal open={!!edit} title={edit?.id ? "কোর্স এডিট" : "নতুন কোর্স"} onClose={() => setEdit(null)}>
        {edit && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const body = { ...edit.f, fee: edit.f.isPaid ? Number(edit.f.fee) : 0 };
              run(() => (edit.id ? api(`/batches/${edit.id}`, { method: "PATCH", body }) : api("/batches", { body }))).then(() => setEdit(null));
            }}
          >
            <Field label="কোর্সের নাম">{(id) => <input id={id} className={inputCls} required value={edit.f.title} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, title: e.target.value } })} />}</Field>
            <Field label="লিংকের নাম (স্লাগ)" hint="খালি রাখলে কোর্সের নাম থেকে নিজে তৈরি হবে। যেমন: hsc-physics-2027">{(id) => <input id={id} className={`${inputCls} font-mono`} maxLength={60} value={edit.f.slug} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, slug: e.target.value } })} />}</Field>
            <Field label="সাবটাইটেল" hint="কোর্স কার্ড ও পাতার শিরোনামের নিচে এক লাইনে দেখায়">{(id) => <input id={id} className={inputCls} maxLength={160} value={edit.f.subtitle} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, subtitle: e.target.value } })} />}</Field>
            <Field label="বিবরণ">{(id) => <textarea id={id} rows={3} className={inputCls} value={edit.f.description} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, description: e.target.value } })} />}</Field>
            <Field label="সময়কাল" hint="যেমন: ৩ মাস">{(id) => <input id={id} className={inputCls} maxLength={60} value={edit.f.duration} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, duration: e.target.value } })} />}</Field>
            <Field label="কী শিখবেন" hint="প্রতি লাইনে একটি পয়েন্ট (সর্বোচ্চ ১২টি)">{(id) => <textarea id={id} rows={4} className={inputCls} value={edit.f.highlights} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, highlights: e.target.value } })} />}</Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4 accent-brand" checked={edit.f.isPaid} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, isPaid: e.target.checked } })} />
              পেইড কোর্স
            </label>
            {edit.f.isPaid && (
              <Field label="ফি (৳)">{(id) => <input id={id} className={inputCls} type="number" min={1} required value={edit.f.fee} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, fee: e.target.value } })} />}</Field>
            )}
            {edit.f.isPaid && (
              <Field label="ফি নেওয়ার নিয়ম" hint="মাসিক হলে প্রতি ৩০ দিনে ফি দিয়ে নবায়ন করতে হবে; মেয়াদ শেষে কোর্স বন্ধ থাকবে">
                {(id) => (
                  <select id={id} className={inputCls} value={edit.f.billing} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, billing: e.target.value } })}>
                    <option value="ONCE">একবারে (পুরো কোর্সের জন্য)</option>
                    <option value="MONTHLY">মাসিক (প্রতি ৩০ দিনে)</option>
                  </select>
                )}
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setEdit(null)}>
                বাতিল
              </button>
              <button className={btnCls}>সংরক্ষণ</button>
            </div>
          </form>
        )}
      </Modal>

      {/* assign teachers */}
      <Modal open={!!assign} title={`শিক্ষক অ্যাসাইন — ${assign?.course.title ?? ""}`} onClose={() => setAssign(null)}>
        {assign && (
          <div className="space-y-4">
            {teachers.length === 0 && <p className="text-sm text-sub">আগে “শিক্ষক ও অ্যাক্সেস” পেজ থেকে শিক্ষক অ্যাকাউন্ট তৈরি করুন।</p>}
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {teachers.map((t) => (
                <li key={t.id}>
                  <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={assign.ids.has(t.id)}
                      onChange={(e) => {
                        const next = new Set(assign.ids);
                        if (e.target.checked) next.add(t.id);
                        else next.delete(t.id);
                        setAssign({ ...assign, ids: next });
                      }}
                    />
                    <span className="text-sm">
                      <b>{t.name}</b> <span className="text-faint">{t.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setAssign(null)}>
                বাতিল
              </button>
              <button
                className={btnCls}
                onClick={() =>
                  run(() => api(`/admin/batches/${assign.course.id}/teachers`, { method: "PUT", body: { teacherIds: [...assign.ids] } })).then(() => setAssign(null))
                }
              >
                সংরক্ষণ
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!del}
        title="কোর্স মুছবেন?"
        message={`“${del?.title}” এবং এর সব ভর্তি, ক্লাস, নোট ও পরীক্ষা চিরতরে মুছে যাবে। এটি ফেরানো যাবে না।`}
        confirmLabel="মুছে ফেলুন"
        onConfirm={() => del && run(() => api(`/batches/${del.id}`, { method: "DELETE" }))}
        onClose={() => setDel(null)}
      />
    </div>
  );
}
