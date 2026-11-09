"use client";

import { useEffect, useState } from "react";
import { Card, ErrorMsg, Field, PageHeader, Skeleton, btnCls, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Settings = { bkash: string; nagad: string; rocket: string; bank: string; supportPhone: string; supportEmail: string; siteName: string; siteTagline: string; announcements: string };

export default function AdminSettings() {
  const user = useRequireUser("ADMIN");
  const [f, setF] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<Settings>("/admin/settings")
      .then(setF)
      .catch((e) => setError(e.message));
  }, [user]);

  if (!user) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      setF(await api<Settings>("/admin/settings", { method: "PUT", body: f }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setF({ ...f!, [k]: e.target.value });
  };

  return (
    <div className="fade-in max-w-2xl">
      <PageHeader title="সেটিংস" subtitle="চেকআউট পেজে শিক্ষার্থীরা এই নম্বরগুলো দেখবে" />
      <ErrorMsg error={error} />
      {!f && !error && <Skeleton className="h-64" />}
      {f && (
        <form onSubmit={save} className="space-y-6">
          <Card className="space-y-4">
            <h2 className="font-bold">পেমেন্ট নম্বর</h2>
            <p className="-mt-2 text-sm text-sub">যে মেথডের নম্বর ফাঁকা থাকবে, সেটি দিয়ে শিক্ষার্থী পেমেন্ট জমা দিতে পারবে না।</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="bKash (Personal)">{(i) => <input id={i} className={inputCls} inputMode="tel" value={f.bkash} onChange={set("bkash")} />}</Field>
              <Field label="Nagad (Personal)">{(i) => <input id={i} className={inputCls} inputMode="tel" value={f.nagad} onChange={set("nagad")} />}</Field>
              <Field label="Rocket">{(i) => <input id={i} className={inputCls} inputMode="tel" value={f.rocket} onChange={set("rocket")} />}</Field>
            </div>
            <Field label="ব্যাংক ট্রান্সফারের তথ্য" hint="ব্যাংক, অ্যাকাউন্টের নাম ও নম্বর, ব্রাঞ্চ — যেভাবে দেখাতে চান">
              {(i) => <textarea id={i} rows={3} className={inputCls} value={f.bank} onChange={set("bank")} />}
            </Field>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-bold">হোমপেজ</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="প্রতিষ্ঠানের নাম" hint="হোমপেজের হেডারে দেখাবে">{(i) => <input id={i} className={inputCls} maxLength={80} value={f.siteName} onChange={set("siteName")} />}</Field>
              <Field label="ঠিকানা / ট্যাগলাইন">{(i) => <input id={i} className={inputCls} maxLength={200} value={f.siteTagline} onChange={set("siteTagline")} />}</Field>
            </div>
            <Field label="নোটিশ বোর্ড" hint="প্রতি লাইনে একটি নোটিশ (সর্বোচ্চ ৮টি)। এগুলো হোমপেজের চলমান নোটিশ ও নোটিশ বোর্ডে দেখাবে।">
              {(i) => <textarea id={i} rows={5} maxLength={1200} className={inputCls} value={f.announcements} onChange={set("announcements")} />}
            </Field>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-bold">সাপোর্ট যোগাযোগ</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ফোন">{(i) => <input id={i} className={inputCls} inputMode="tel" value={f.supportPhone} onChange={set("supportPhone")} />}</Field>
              <Field label="ইমেইল">{(i) => <input id={i} type="email" className={inputCls} value={f.supportEmail} onChange={set("supportEmail")} />}</Field>
            </div>
          </Card>
          <div className="flex items-center gap-3">
            <button className={btnCls} disabled={busy}>
              {busy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
            {saved && (
              <span role="status" className="text-sm font-semibold text-ok">
                সংরক্ষণ হয়েছে ✓
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
