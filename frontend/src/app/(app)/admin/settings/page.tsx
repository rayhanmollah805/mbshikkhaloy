"use client";

import { useEffect, useState } from "react";
import { btnDanger, btnGhost } from "@/components/ui";
import { Card, ErrorMsg, Field, PageHeader, Skeleton, btnCls, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Settings = { bkash: string; nagad: string; rocket: string; bank: string; supportPhone: string; supportEmail: string; siteName: string; siteTagline: string; announcements: string };

type YtStatus = { configured: boolean; connected: boolean; channel: string | null; redirectUri: string };

function YouTubeCard() {
  const [st, setSt] = useState<YtStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const load = () => api<YtStatus>("/youtube/status").then(setSt).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    const r = new URLSearchParams(location.search).get("youtube");
    if (r) setFlash(r === "connected" ? "YouTube সংযুক্ত হয়েছে ✓" : "YouTube সংযোগ হয়নি, আবার চেষ্টা করুন");
  }, []);
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">YouTube লাইভ</h2>
      <p className="-mt-1 text-sm text-sub">সংযুক্ত করলে নতুন লাইভ ক্লাস তৈরির সময় YouTube এ স্বয়ংক্রিয়ভাবে লাইভ স্ট্রিম তৈরি হবে এবং ওয়েবসাইট থেকেই স্ট্রিম করা যাবে।</p>
      <ErrorMsg error={err} />
      {flash && <p className="text-sm font-medium text-brand">{flash}</p>}
      {!st && <Skeleton className="h-12" />}
      {st && !st.configured && (
        <div className="rounded-lg bg-canvas p-3 text-sm text-sub">
          <p className="font-semibold text-ink">সার্ভারে Google API কী সেট করা নেই।</p>
          <p className="mt-1">Google Cloud Console এ OAuth Client (Web) বানিয়ে <code>GOOGLE_CLIENT_ID</code> ও <code>GOOGLE_CLIENT_SECRET</code> সার্ভারের <code>backend.env</code> এ দিন। Authorized redirect URI:</p>
          <code className="mt-1 block break-all text-ink">{st.redirectUri}</code>
        </div>
      )}
      {st?.configured && st.connected && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">সংযুক্ত চ্যানেল: <b>{st.channel}</b></span>
          <button type="button" className={btnDanger} onClick={() => api("/youtube/disconnect", { method: "POST" }).then(load).catch((e) => setErr(e.message))}>
            সংযোগ বিচ্ছিন্ন করুন
          </button>
        </div>
      )}
      {st?.configured && !st.connected && (
        <button type="button" className={btnCls} onClick={() => api<{ url: string }>("/youtube/auth-url").then((r) => (location.href = r.url)).catch((e) => setErr(e.message))}>
          YouTube চ্যানেল কানেক্ট করুন
        </button>
      )}
      <button type="button" className={btnGhost} onClick={load}>
        স্ট্যাটাস রিফ্রেশ
      </button>
    </Card>
  );
}

type TfaStatus = { enabled: boolean; recoveryLeft: number };
function TwoFactorCard() {
  const [st, setSt] = useState<TfaStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [off, setOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => api<TfaStatus>("/auth/2fa/status").then(setSt).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ব্যর্থ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">Authenticator (২-ধাপ লগইন)</h2>
      <p className="-mt-1 text-sm text-sub">চালু করলে অ্যাডমিন লগইনে পাসওয়ার্ডের পরে Google Authenticator-এর ৬ সংখ্যার কোড লাগবে। পাসওয়ার্ড ফাঁস হলেও কেউ ঢুকতে পারবে না।</p>
      <ErrorMsg error={err} />
      {!st && <Skeleton className="h-12" />}

      {codes && (
        <div className="space-y-2 rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm">
          <p className="font-bold">রিকভারি কোড — এখনই সংরক্ষণ করুন</p>
          <p>ফোন হারালে বা অ্যাপ না পেলে এই কোডগুলো দিয়ে ঢুকতে পারবেন। প্রতিটি একবারই কাজ করে। এই কোডগুলো আর দেখানো হবে না।</p>
          <div className="grid grid-cols-2 gap-1 font-mono text-base">{codes.map((c) => <span key={c}>{c}</span>)}</div>
          <div className="flex gap-2">
            <button type="button" className={btnGhost} onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>কপি করুন</button>
            <button type="button" className={btnCls} onClick={() => setCodes(null)}>সংরক্ষণ করেছি</button>
          </div>
        </div>
      )}

      {st && !st.enabled && !setup && !codes && (
        <button type="button" className={btnCls} disabled={busy} onClick={() => run(async () => setSetup(await api("/auth/2fa/setup", { method: "POST", body: {} })))}>
          Authenticator চালু করুন
        </button>
      )}

      {st && !st.enabled && setup && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await api<{ recoveryCodes: string[] }>("/auth/2fa/enable", { body: { code } });
              setCodes(r.recoveryCodes);
              setSetup(null);
              setCode("");
              await load();
            });
          }}
        >
          <ol className="list-inside list-decimal space-y-1 text-sm text-sub">
            <li>ফোনে <b className="text-ink">Google Authenticator</b> অ্যাপ খুলুন → “+” → “QR কোড স্ক্যান করুন”।</li>
            <li>নিচের QR কোডটি স্ক্যান করুন (স্ক্যান না হলে নিচের কী-টি হাতে লিখে দিন)।</li>
            <li>অ্যাপে যে ৬ সংখ্যা দেখাচ্ছে সেটি নিচে লিখে নিশ্চিত করুন।</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="Authenticator QR কোড" width={200} height={200} className="rounded-lg border border-line bg-white" />
            <div className="text-sm">
              <p className="text-sub">হাতে লেখার কী:</p>
              <code className="break-all font-mono text-base font-bold">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
            </div>
          </div>
          <Field label="অ্যাপের ৬ সংখ্যার কোড">
            {(i) => <input id={i} className={`${inputCls} w-40 text-center font-mono text-lg tracking-widest`} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />}
          </Field>
          <div className="flex gap-2">
            <button className={btnCls} disabled={busy}>নিশ্চিত করে চালু করুন</button>
            <button type="button" className={btnGhost} onClick={() => { setSetup(null); setCode(""); }}>বাতিল</button>
          </div>
        </form>
      )}

      {st?.enabled && !off && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-ok">✓ চালু আছে</span>
          <span className="text-sub">অব্যবহৃত রিকভারি কোড: {st.recoveryLeft}টি</span>
          <button type="button" className={btnDanger} onClick={() => setOff(true)}>বন্ধ করুন</button>
        </div>
      )}
      {st?.enabled && off && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/auth/2fa/disable", { body: { password, code } });
              setOff(false);
              setPassword("");
              setCode("");
              await load();
            });
          }}
        >
          <Field label="আপনার পাসওয়ার্ড">{(i) => <input id={i} className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          <Field label="Authenticator কোড বা রিকভারি কোড">{(i) => <input id={i} className={`${inputCls} font-mono`} required value={code} onChange={(e) => setCode(e.target.value)} />}</Field>
          <div className="flex gap-2">
            <button className={btnDanger} disabled={busy}>বন্ধ করুন</button>
            <button type="button" className={btnGhost} onClick={() => setOff(false)}>বাতিল</button>
          </div>
        </form>
      )}
    </Card>
  );
}

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
      <div className="mb-6">
        <TwoFactorCard />
        <YouTubeCard />
      </div>
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
