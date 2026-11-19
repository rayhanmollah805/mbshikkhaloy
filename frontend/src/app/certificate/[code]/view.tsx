"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { api } from "@/lib/api";
import { SITE_NAME } from "@/lib/brand";

type Cert = { code: string; name: string; course: string; issuedAt: string };

/** Public: also serves as the "is this certificate genuine?" check. */
export default function Certificate() {
  const { code } = useParams<{ code: string }>();
  const [c, setC] = useState<Cert | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    api<Cert>(`/public/certificates/${code}`).then(setC).catch(() => setError(true));
  }, [code]);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas p-6 text-center">
        <div>
          <p className="text-xl font-bold text-danger">সার্টিফিকেটটি পাওয়া যায়নি</p>
          <p className="mt-1 text-sub">কোডটি সঠিক নয় বা সার্টিফিকেটটি আসল নয়।</p>
          <Link href="/" className="mt-4 inline-block text-brand underline">হোম পেজে যান</Link>
        </div>
      </main>
    );
  }
  if (!c) return <main className="grid min-h-screen place-items-center bg-canvas text-sub">লোড হচ্ছে…</main>;
  const date = new Date(c.issuedAt).toLocaleDateString("bn-BD", { dateStyle: "long" });
  return (
    <main className="force-light min-h-screen bg-canvas px-4 py-8 print:bg-white print:p-0">
      <style>{`@page { size: A4 landscape; margin: 0 } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>
      <div className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard" className="text-sm font-medium text-brand hover:underline">← ড্যাশবোর্ড</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          PDF ডাউনলোড / প্রিন্ট
        </button>
      </div>
      <div className="mx-auto aspect-[297/210] w-full max-w-4xl border-[10px] border-double border-brand bg-white p-8 text-center shadow-lg print:max-w-none print:border-[10px] print:shadow-none sm:p-12">
        <div className="flex h-full flex-col items-center justify-between">
          <div>
            <LogoMark className="mx-auto size-16" />
            <p className="mt-2 text-xl font-bold text-brand-dark sm:text-2xl">{SITE_NAME}</p>
          </div>
          <div>
            <p className="text-3xl font-bold tracking-wide text-ink sm:text-5xl">সার্টিফিকেট অব কমপ্লিশন</p>
            <p className="mt-5 text-sub">এই মর্মে প্রত্যয়ন করা যাচ্ছে যে</p>
            <p className="mt-3 border-b-2 border-brand px-8 pb-2 text-3xl font-bold text-brand-dark sm:text-4xl">{c.name}</p>
            <p className="mt-4 text-sub">সফলভাবে সম্পন্ন করেছেন</p>
            <p className="mt-2 text-xl font-bold text-ink sm:text-2xl">{c.course}</p>
          </div>
          <div className="flex w-full items-end justify-between text-xs text-sub sm:text-sm">
            <div className="text-left">
              <p>প্রদানের তারিখ</p>
              <p className="font-semibold text-ink">{date}</p>
            </div>
            <div className="text-right">
              <p>সার্টিফিকেট নম্বর</p>
              <p className="font-mono font-semibold text-ink">{c.code}</p>
              <p className="text-faint">যাচাই: /certificate/{c.code}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
