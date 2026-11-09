"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { homeFor, useAuth, type User } from "@/lib/auth";
import { safeNext } from "@/lib/public";

export default function RegisterPage() {
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string; user: User }>("/auth/register", { body: f });
      login(r.token, r.user);
      router.replace(safeNext(next, homeFor(r.user.role)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "রেজিস্ট্রেশন ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="শিক্ষার্থী রেজিস্ট্রেশন" subtitle="কয়েক সেকেন্ডেই অ্যাকাউন্ট খুলুন">
      <form onSubmit={submit} className="space-y-4">
        <Field label="নাম">{(id) => <input id={id} className={inputCls} required value={f.name} onChange={set("name")} />}</Field>
        <Field label="ইমেইল">{(id) => <input id={id} className={inputCls} type="email" autoComplete="username" required value={f.email} onChange={set("email")} />}</Field>
        <Field label="মোবাইল নম্বর (ঐচ্ছিক)">{(id) => <input id={id} className={inputCls} inputMode="tel" value={f.phone} onChange={set("phone")} />}</Field>
        <Field label="পাসওয়ার্ড" hint="কমপক্ষে ৬ অক্ষর">
          {(id) => <input id={id} className={inputCls} type="password" autoComplete="new-password" minLength={6} required value={f.password} onChange={set("password")} />}
        </Field>
        <ErrorMsg error={error} />
        <button className={`${btnCls} w-full`} disabled={busy}>
          {busy ? "অপেক্ষা করুন..." : "রেজিস্ট্রেশন"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-sub">
        আগেই অ্যাকাউন্ট আছে?{" "}
        <Link href={`/login${qs}`} className="font-semibold text-brand hover:underline">
          লগইন
        </Link>
      </p>
    </AuthLayout>
  );
}
