"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { coverFor } from "@/components/course-card";
import { Icon } from "@/components/icons";
import { Card, EmptyState, ErrorMsg, Field, Skeleton, bn, btnCls, btnGhost, inputCls, taka } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useEnrollState, usePublic, type PublicCourseDetail, type SiteInfo } from "@/lib/public";

type Method = "bKash" | "Nagad" | "Rocket" | "Bank";
const METHODS: { key: Method; label: string; setting: keyof SiteInfo["settings"] }[] = [
  { key: "bKash", label: "bKash", setting: "bkash" },
  { key: "Nagad", label: "Nagad", setting: "nagad" },
  { key: "Rocket", label: "Rocket", setting: "rocket" },
  { key: "Bank", label: "ব্যাংক", setting: "bank" },
];

const safe = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export default function Checkout() {
  const { id: raw } = useParams<{ id: string }>();
  const key = safe(raw);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { data: c, error } = usePublic<PublicCourseDetail>(`/public/courses/${encodeURIComponent(key)}`);
  const { data: site } = usePublic<SiteInfo>("/public/site");
  const { status, refresh } = useEnrollState(c?.id ?? "");

  const [method, setMethod] = useState<Method>("bKash");
  const [trxId, setTrxId] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [price, setPrice] = useState<{ amount: number; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  // Checkout needs an account; send guests to login and bring them back.
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(`/checkout/${raw}`)}`);
  }, [loading, user, raw, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState icon="search" title="কোর্সটি পাওয়া যায়নি" />
        <div className="mt-6 text-center">
          <Link href="/explore" className={btnCls}>সব কোর্স দেখুন</Link>
        </div>
      </div>
    );
  }
  if (!c || loading || !user || status === "loading") {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (user.role !== "STUDENT") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState icon="lock" title="শুধু শিক্ষার্থীরা ভর্তি হতে পারে" hint="শিক্ষার্থী অ্যাকাউন্ট দিয়ে লগইন করে আবার চেষ্টা করুন।" />
      </div>
    );
  }

  const fee = price ? price.amount : c.fee;
  const free = c.isPaid && fee === 0;
  const per = c.billing === "MONTHLY" ? "/মাস" : "";
  const number = site ? site.settings[METHODS.find((m) => m.key === method)!.setting] : "";
  const isBank = method === "Bank";

  async function enroll(body: object) {
    setBusy(true);
    setFormError(null);
    try {
      await api(`/batches/${c!.id}/enroll`, { body: { ...body, coupon: coupon.trim() || undefined } });
      if (!c!.isPaid) router.replace(`/batches/${c!.id}`);
      else refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  // ---- terminal states ----
  if (status === "ACTIVE") {
    return (
      <Done tone="ok" title="আপনি এই কোর্সে ভর্তি আছেন" text="কোর্সের সব কনটেন্ট এখন আপনার জন্য খোলা।">
        <Link href={`/batches/${c.id}`} className={btnCls}>কোর্সে যান</Link>
      </Done>
    );
  }
  if (status === "PENDING") {
    return (
      <Done tone="warn" title="পেমেন্ট জমা হয়েছে" text="শিক্ষক/অ্যাডমিন আপনার Transaction ID যাচাই করছেন। অনুমোদন হলেই কোর্স খুলে যাবে — এর জন্য আর কিছু করতে হবে না।">
        <Link href="/dashboard" className={btnCls}>ড্যাশবোর্ডে যান</Link>
        <Link href="/explore" className={btnGhost}>আরও কোর্স দেখুন</Link>
      </Done>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href={`/explore/${raw}`} className="text-sm font-medium text-brand hover:underline">← কোর্সে ফিরে যান</Link>
      <h1 className="mb-6 mt-2 text-3xl font-bold tracking-tight">{c.isPaid ? "পেমেন্ট" : "ভর্তি নিশ্চিত করুন"}</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {status === "REJECTED" && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
              আগের পেমেন্ট গ্রহণ করা হয়নি। সঠিক Transaction ID দিয়ে আবার চেষ্টা করুন।
            </div>
          )}

          {c.isPaid ? (
            <Card>
              <h2 className="mb-4 text-lg font-bold">১. পেমেন্ট মেথড বেছে নিন</h2>
              <div role="radiogroup" aria-label="পেমেন্ট মেথড" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {METHODS.map((m) => (
                  <button
                    key={m.key}
                    role="radio"
                    aria-checked={method === m.key}
                    onClick={() => setMethod(m.key)}
                    className={`rounded-lg border-2 px-3 py-3 text-sm font-bold transition-colors ${method === m.key ? "border-brand bg-brand-soft text-brand-dark" : "border-line text-ink hover:bg-canvas"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-xl bg-canvas p-4">
                <h2 className="mb-3 text-lg font-bold">২. টাকা পাঠান</h2>
                {number ? (
                  isBank ? (
                    <p className="whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-sm">{number}</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-lg border border-line bg-surface px-4 py-2 font-mono text-xl font-bold tracking-wide">{number}</span>
                      <button
                        className={btnGhost}
                        onClick={() => {
                          navigator.clipboard?.writeText(number).then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                          });
                        }}
                      >
                        {copied ? "কপি হয়েছে ✓" : "নম্বর কপি"}
                      </button>
                    </div>
                  )
                ) : (
                  <p className="flex items-start gap-2 text-sm text-warn">
                    <Icon name="alert" className="mt-0.5 size-4 shrink-0" /> এই মেথডের নম্বর এখনো দেওয়া হয়নি। অন্য মেথড বেছে নিন বা সাপোর্টে যোগাযোগ করুন।
                  </p>
                )}
                <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-sub">
                  {!isBank && <li>{method} অ্যাপে “Send Money” বেছে নিন।</li>}
                  <li>
                    ঠিক <b className="text-ink">{taka(fee)}{per}</b> পাঠান।
                  </li>
                  <li>পেমেন্ট শেষে পাওয়া Transaction ID টি নিচে লিখুন।</li>
                </ol>
              </div>

              <div className="mt-5">
                <h2 className="mb-2 text-lg font-bold">কুপন কোড আছে?</h2>
                <div className="flex gap-2">
                  <input className={`${inputCls} font-mono uppercase`} placeholder="কুপন কোড" value={coupon} onChange={(e) => { setCoupon(e.target.value); setPrice(null); setCouponMsg(null); }} />
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={!coupon.trim()}
                    onClick={async () => {
                      setCouponMsg(null);
                      try {
                        const r = await api<{ amount: number; discount: number }>("/coupons/validate", { body: { batchId: c!.id, code: coupon } });
                        setPrice(r);
                        setCouponMsg(`ছাড় পেয়েছেন ${taka(r.discount)}`);
                      } catch (e) {
                        setPrice(null);
                        setCouponMsg(e instanceof Error ? e.message : "ব্যর্থ");
                      }
                    }}
                  >
                    প্রয়োগ করুন
                  </button>
                </div>
                {couponMsg && <p className={`mt-1 text-sm ${price ? "text-ok" : "text-danger"}`}>{couponMsg}</p>}
              </div>

              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  enroll({ method, trxId });
                }}
              >
                <h2 className="text-lg font-bold">৩. Transaction ID দিন</h2>
                {free ? (
                  <p className="rounded-lg bg-ok-soft p-3 text-sm text-ok">কুপনে কোর্সটি সম্পূর্ণ ফ্রি হয়েছে — Transaction ID লাগবে না।</p>
                ) : (
                <Field label="Transaction ID" hint="পেমেন্টের SMS/অ্যাপে এটি পাবেন (যেমন: 8N7A6D5F4C)">
                  {(i) => <input id={i} className={`${inputCls} font-mono`} required autoComplete="off" value={trxId} onChange={(e) => setTrxId(e.target.value)} />}
                </Field>
                )}
                <ErrorMsg error={formError} />
                <button className={`${btnCls} min-h-12 w-full text-base`} disabled={busy || (!number && !free)}>
                  {busy ? "জমা হচ্ছে..." : free ? "ফ্রিতে ভর্তি হন" : "পেমেন্ট জমা দিন"}
                </button>
              </form>
            </Card>
          ) : (
            <Card>
              <h2 className="mb-2 text-lg font-bold">এই কোর্সটি ফ্রি</h2>
              <p className="mb-5 text-sub">কোনো পেমেন্ট লাগবে না। নিচের বাটনে চাপলেই সাথে সাথে ভর্তি হয়ে যাবেন।</p>
              <ErrorMsg error={formError} />
              <button className={`${btnCls} mt-2 min-h-12 text-base`} disabled={busy} onClick={() => enroll({})}>
                {busy ? "অপেক্ষা করুন..." : "ফ্রিতে ভর্তি হন"}
              </button>
            </Card>
          )}
        </div>

        {/* Order summary */}
        <aside>
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className={`${coverFor(c.id)} p-5`}>
              <p className="text-sm text-white/80">আপনার অর্ডার</p>
              <h2 className="mt-1 text-lg font-bold leading-snug text-white">{c.title}</h2>
            </div>
            <div className="space-y-3 p-5 text-sm">
              {c.teachers.length > 0 && <Row k="শিক্ষক" v={c.teachers.join(", ")} />}
              {c.duration && <Row k="সময়কাল" v={c.duration} />}
              <Row k="কোর্স ফি" v={c.isPaid ? `${taka(c.fee)}${per}` : "ফ্রি"} />
              {price && price.discount > 0 && <Row k="কুপন ছাড়" v={`−${taka(price.discount)}`} />}
              {c.billing === "MONTHLY" && <p className="text-xs text-faint">প্রতি ৩০ দিনে ফি দিয়ে নবায়ন করতে হবে।</p>}
              <div className="flex items-center justify-between border-t border-line pt-3 text-base">
                <span className="font-semibold">মোট</span>
                <span className="text-xl font-bold text-brand">{c.isPaid ? `${taka(fee)}${per}` : "ফ্রি"}</span>
              </div>
              <p className="flex items-start gap-2 pt-1 text-xs text-faint">
                <Icon name="lock" className="mt-0.5 size-3.5 shrink-0" />
                যাচাই শেষে কোর্স খুলে যাবে।{site?.settings.supportPhone ? ` সমস্যায় কল করুন: ${site.settings.supportPhone}` : ""}
              </p>
              {c.students > 0 && <p className="text-xs text-faint">{bn(c.students)} জন শিক্ষার্থী ইতিমধ্যে আছেন</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sub">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function Done({ tone, title, text, children }: { tone: "ok" | "warn"; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="fade-in rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <span className={`mx-auto grid size-16 place-items-center rounded-full ${tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
          <Icon name={tone === "ok" ? "check" : "clock"} className="size-8" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sub">{text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>
      </div>
    </div>
  );
}
