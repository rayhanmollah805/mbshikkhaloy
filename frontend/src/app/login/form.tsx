"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { ErrorMsg, Field, btnCls, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { homeFor, useAuth, type User } from "@/lib/auth";
import { safeNext } from "@/lib/public";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = mfaToken
        ? await api<{ token: string; user: User }>("/auth/login/2fa", { body: { mfaToken, code } })
        : await api<{ token?: string; user?: User; mfaRequired?: boolean; mfaToken?: string }>("/auth/login", { body: { email, password } });
      if ("mfaRequired" in r && r.mfaRequired) {
        setMfaToken(r.mfaToken!);
        setPassword("");
        return;
      }
      login(r.token!, r.user!);
      router.replace(safeNext(next, homeFor(r.user!.role)));
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      if (mfaToken && /শেষ/.test(m)) {
        setMfaToken(null);
        setCode("");
      }
      setError(m && m !== "Invalid credentials" ? m : "ইমেইল বা পাসওয়ার্ড ভুল");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="স্বাগতম" subtitle="আপনার অ্যাকাউন্টে লগইন করুন">
      {mfaToken ? (
        <form onSubmit={submit} className="space-y-4">
          <p className="rounded-lg bg-brand-soft p-3 text-sm text-brand-dark">Google Authenticator অ্যাপ খুলে এই অ্যাকাউন্টের ৬ সংখ্যার কোডটি দিন। ফোন না থাকলে একটি রিকভারি কোড দিন।</p>
          <Field label="ভেরিফিকেশন কোড">
            {(id) => <input id={id} className={`${inputCls} text-center font-mono text-xl tracking-widest`} inputMode="text" autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />}
          </Field>
          <ErrorMsg error={error} />
          <button className={`${btnCls} w-full`} disabled={busy}>
            {busy ? "যাচাই হচ্ছে..." : "যাচাই করে লগইন"}
          </button>
          <button type="button" className="w-full text-center text-sm text-sub hover:underline" onClick={() => { setMfaToken(null); setCode(""); setError(null); }}>
            ← অন্য অ্যাকাউন্টে লগইন
          </button>
        </form>
      ) : (
      <form onSubmit={submit} className="space-y-4">
        <Field label="ইমেইল">
          {(id) => <input id={id} className={inputCls} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="পাসওয়ার্ড">
          {(id) => <input id={id} className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <ErrorMsg error={error} />
        <button className={`${btnCls} w-full`} disabled={busy}>
          {busy ? "অপেক্ষা করুন..." : "লগইন"}
        </button>
      </form>
      )}
      <p className="mt-6 text-center text-sm text-sub">
        নতুন শিক্ষার্থী?{" "}
        <Link href={`/register${qs}`} className="font-semibold text-brand hover:underline">
          অ্যাকাউন্ট খুলুন
        </Link>
      </p>
    </AuthLayout>
  );
}
