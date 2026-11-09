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
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string; user: User }>("/auth/login", { body: { email, password } });
      login(r.token, r.user);
      router.replace(safeNext(next, homeFor(r.user.role)));
    } catch (err) {
      setError(err instanceof Error && err.message !== "Invalid credentials" ? err.message : "ইমেইল বা পাসওয়ার্ড ভুল");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="স্বাগতম" subtitle="আপনার অ্যাকাউন্টে লগইন করুন">
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
      <p className="mt-6 text-center text-sm text-sub">
        নতুন শিক্ষার্থী?{" "}
        <Link href={`/register${qs}`} className="font-semibold text-brand hover:underline">
          অ্যাকাউন্ট খুলুন
        </Link>
      </p>
    </AuthLayout>
  );
}
