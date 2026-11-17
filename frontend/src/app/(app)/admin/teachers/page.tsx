"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorMsg,
  Field,
  Modal,
  PageHeader,
  Skeleton,
  btnCls,
  btnGhost,
  inputCls,
} from "@/components/ui";
import { api, fileUrl, uploadAvatar } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Perm = { key: string; label: string };
type Course = { id: string; title: string };
type Teacher = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  designation: string | null;
  subject: string | null;
  photoUrl: string | null;
  isActive: boolean;
  permissions: string[];
  batches: Course[];
};
type Form = {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  designation: string;
  subject: string;
  photoUrl: string | null;
  photo: File | null;
  password: string;
  isActive: boolean;
  permissions: Set<string>;
  batchIds: Set<string>;
};

const blank = (): Form => ({
  id: null,
  name: "",
  email: "",
  phone: "",
  address: "",
  designation: "",
  subject: "",
  photoUrl: null,
  photo: null,
  password: "",
  isActive: true,
  permissions: new Set(["content.manage", "exam.manage"]),
  batchIds: new Set(),
});

function toggle(set: Set<string>, key: string, on: boolean) {
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}

export default function AdminTeachers() {
  const user = useRequireUser("ADMIN");
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [t, p, c] = await Promise.all([
      api<Teacher[]>("/admin/users?role=TEACHER"),
      api<Perm[]>("/admin/permissions"),
      api<Course[]>("/batches"),
    ]);
    setTeachers(t);
    setPerms(p);
    setCourses(c);
  }, []);
  useEffect(() => {
    if (!user) return;
    // Initial data fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(e.message));
  }, [user, load]);

  if (!user) return null;

  const presets: { label: string; keys: string[] }[] = [
    { label: "পূর্ণ শিক্ষক", keys: perms.map((p) => p.key) },
    { label: "কনটেন্ট ও পরীক্ষা", keys: ["content.manage", "exam.manage"] },
    { label: "শুধু দেখা", keys: ["student.view"] },
    { label: "কিছুই নয়", keys: [] },
  ];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setFormError(null);
    const permissions = [...form.permissions];
    const batchIds = [...form.batchIds];
    try {
      const profile = { name: form.name, phone: form.phone, address: form.address, designation: form.designation, subject: form.subject };
      let uid = form.id;
      if (uid) {
        await api(`/admin/users/${uid}`, {
          method: "PATCH",
          body: { ...profile, email: form.email, isActive: form.isActive, permissions, ...(form.password ? { password: form.password } : {}) },
        });
        await api(`/admin/users/${uid}/batches`, { method: "PUT", body: { batchIds } });
      } else {
        uid = (await api<{ id: string }>("/admin/users", { body: { ...profile, email: form.email, password: form.password, permissions, batchIds, role: "TEACHER" } })).id;
      }
      if (form.photo) await uploadAvatar(uid, form.photo);
      setForm(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  const label = (k: string) => perms.find((p) => p.key === k)?.label ?? k;

  return (
    <div className="fade-in">
      <PageHeader
        title="শিক্ষক ও অ্যাক্সেস"
        subtitle="শিক্ষকের অ্যাকাউন্ট খুলুন এবং কোন কোর্সে কী কী করতে পারবেন তা ঠিক করুন"
        action={
          <button className={btnCls} onClick={() => { setFormError(null); setForm(blank()); }}>
            <Icon name="plus" className="size-4" /> নতুন শিক্ষক
          </button>
        }
      />
      <ErrorMsg error={error} />
      {!teachers && <Skeleton className="h-40" />}
      {teachers?.length === 0 && <EmptyState icon="teacher" title="এখনো কোনো শিক্ষক নেই" hint="“নতুন শিক্ষক” চেপে অ্যাকাউন্ট তৈরি করুন এবং কোর্স অ্যাসাইন করুন।" />}

      <div className="grid gap-4 lg:grid-cols-2">
        {teachers?.map((t) => (
          <Card key={t.id} className={t.isActive ? "" : "opacity-70"}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={t.name} src={t.photoUrl ? fileUrl(t.photoUrl) : null} size="size-14" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{t.name}</p>
                  {(t.designation || t.subject) && <p className="truncate text-sm font-medium text-brand-dark">{[t.designation, t.subject].filter(Boolean).join(" · ")}</p>}
                  <p className="truncate text-sm text-sub">{t.phone ? `${t.email} · ${t.phone}` : t.email}</p>
                  {t.address && <p className="truncate text-xs text-faint">{t.address}</p>}
                </div>
              </div>
              {t.isActive ? <Badge tone="green">সক্রিয়</Badge> : <Badge tone="red">নিষ্ক্রিয়</Badge>}
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                  <Icon name="book" className="size-3.5" /> কোর্স
                </p>
                {t.batches.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {t.batches.map((b) => (
                      <Badge key={b.id} tone="brand">{b.title}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-warn">কোনো কোর্স অ্যাসাইন করা নেই</p>
                )}
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                  <Icon name="shield" className="size-3.5" /> অ্যাক্সেস
                </p>
                {t.permissions.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {t.permissions.map((p) => (
                      <Badge key={p}>{label(p)}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sub">কোনো অ্যাক্সেস নেই (শুধু কোর্স দেখতে পারবেন)</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <button
                className={btnGhost}
                onClick={() => {
                  setFormError(null);
                  setForm({
                    id: t.id,
                    name: t.name,
                    email: t.email,
                    phone: t.phone ?? "",
                    address: t.address ?? "",
                    designation: t.designation ?? "",
                    subject: t.subject ?? "",
                    photoUrl: t.photoUrl,
                    photo: null,
                    password: "",
                    isActive: t.isActive,
                    permissions: new Set(t.permissions),
                    batchIds: new Set(t.batches.map((b) => b.id)),
                  });
                }}
              >
                <Icon name="edit" className="size-4" /> অ্যাক্সেস এডিট
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!form} title={form?.id ? "শিক্ষকের অ্যাক্সেস এডিট" : "নতুন শিক্ষক"} onClose={() => setForm(null)} wide>
        {form && (
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="নাম">{(id) => <input id={id} className={inputCls} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
              <Field label="ইমেইল (লগইন)">{(id) => <input id={id} type="email" className={inputCls} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
              <Field label="মোবাইল">{(id) => <input id={id} className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>
              <Field label="পদবি">{(id) => <input id={id} className={inputCls} placeholder="যেমন: ক্লাস টিচার" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />}</Field>
              <Field label="বিষয়">{(id) => <input id={id} className={inputCls} placeholder="যেমন: আর্টস" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}</Field>
              <Field label="ঠিকানা">{(id) => <input id={id} className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />}</Field>
              <Field label="ছবি" hint="JPG, PNG বা WebP, সর্বোচ্চ ২ MB">
                {(id) => (
                  <div className="flex items-center gap-3">
                    <Avatar name={form.name || "?"} src={form.photo ? URL.createObjectURL(form.photo) : form.photoUrl ? fileUrl(form.photoUrl) : null} size="size-12" />
                    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={(e) => setForm({ ...form, photo: e.target.files?.[0] ?? null })} />
                  </div>
                )}
              </Field>
              <Field label={form.id ? "নতুন পাসওয়ার্ড (বদলাতে চাইলে)" : "পাসওয়ার্ড"} hint="কমপক্ষে ৬ অক্ষর">
                {(id) => <input id={id} type="password" autoComplete="new-password" minLength={6} className={inputCls} required={!form.id} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
              </Field>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">অ্যাসাইন করা কোর্স</legend>
              <p className="mb-2 text-xs text-faint">শিক্ষক শুধু এই কোর্সগুলোই দেখতে ও ম্যানেজ করতে পারবেন।</p>
              {courses.length === 0 && <p className="text-sm text-sub">আগে কোর্স তৈরি করুন।</p>}
              <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
                {courses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">
                    <input type="checkbox" className="size-4 accent-brand" checked={form.batchIds.has(c.id)} onChange={(e) => setForm({ ...form, batchIds: toggle(form.batchIds, c.id, e.target.checked) })} />
                    {c.title}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">অ্যাক্সেস (পারমিশন)</legend>
              <div className="mb-3 flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button key={p.label} type="button" className={btnGhost} onClick={() => setForm({ ...form, permissions: new Set(p.keys) })}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {perms.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">
                    <input type="checkbox" className="size-4 accent-brand" checked={form.permissions.has(p.key)} onChange={(e) => setForm({ ...form, permissions: toggle(form.permissions, p.key, e.target.checked) })} />
                    {p.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {form.id && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-4 accent-brand" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                অ্যাকাউন্ট সক্রিয় (বন্ধ করলে সাথে সাথে লগআউট হবে)
              </label>
            )}

            <ErrorMsg error={formError} />
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setForm(null)}>
                বাতিল
              </button>
              <button className={btnCls} disabled={busy}>
                {busy ? "সংরক্ষণ হচ্ছে..." : form.id ? "সংরক্ষণ" : "অ্যাকাউন্ট তৈরি করুন"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
