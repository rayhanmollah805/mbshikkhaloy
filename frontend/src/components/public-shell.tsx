"use client";

import Link from "next/link";
import { useState } from "react";
import { homeFor, useAuth } from "@/lib/auth";
import { usePublic, type SiteInfo } from "@/lib/public";
import { SITE_NAME } from "@/lib/brand";
import { Icon } from "./icons";
import { LogoMark } from "./logo";
import { btnCls, btnGhost } from "./ui";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LogoMark className="size-9" light={light} />
      <span className={`text-lg font-bold ${light ? "text-white" : "text-ink"}`}>{SITE_NAME}</span>
    </Link>
  );
}

const LINKS = [
  { href: "/explore", label: "সব কোর্স" },
  { href: "/#features", label: "সুবিধা" },
  { href: "/#how", label: "কীভাবে ভর্তি হবেন" },
  { href: "/#faq", label: "প্রশ্নোত্তর" },
];

export function PublicNav() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <nav aria-label="প্রধান মেনু" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-[15px] font-medium text-sub transition-colors hover:bg-canvas hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {/* Reserve space while auth resolves so the nav doesn't jump. */}
          <div className="hidden min-w-44 justify-end gap-2 sm:flex">
            {loading ? null : user ? (
              <Link href={homeFor(user.role)} className={btnCls}>
                ড্যাশবোর্ড
              </Link>
            ) : (
              <>
                <Link href="/login" className={btnGhost}>
                  লগইন
                </Link>
                <Link href="/register" className={btnCls}>
                  রেজিস্ট্রেশন
                </Link>
              </>
            )}
          </div>
          <button onClick={() => setOpen((o) => !o)} aria-label="মেনু" aria-expanded={open} className="rounded-lg p-2 hover:bg-canvas md:hidden">
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <div className="fade-in border-t border-line bg-surface px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="মোবাইল মেনু">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 font-medium text-ink hover:bg-canvas">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              {user ? (
                <Link href={homeFor(user.role)} className={`${btnCls} flex-1`}>
                  ড্যাশবোর্ড
                </Link>
              ) : (
                <>
                  <Link href="/login" className={`${btnGhost} flex-1`}>
                    লগইন
                  </Link>
                  <Link href="/register" className={`${btnCls} flex-1`}>
                    রেজিস্ট্রেশন
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { data } = usePublic<SiteInfo>("/public/site");
  const s = data?.settings;
  return (
    <footer id="contact" className="scroll-mt-20 border-t border-line bg-side text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-3 max-w-xs text-sm text-slate-400">লাইভ ক্লাস, ভিডিও লেকচার, নোট ও পরীক্ষা — সব এক জায়গায়।</p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-white">দ্রুত লিংক</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/explore" className="hover:text-white">সব কোর্স</Link></li>
            <li><Link href="/login" className="hover:text-white">লগইন</Link></li>
            <li><Link href="/register" className="hover:text-white">রেজিস্ট্রেশন</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-white">যোগাযোগ</p>
          <ul className="space-y-2 text-sm">
            {s?.supportPhone && <li>{s.supportPhone}</li>}
            {s?.supportEmail && <li>{s.supportEmail}</li>}
            {!s?.supportPhone && !s?.supportEmail && <li className="text-slate-500">—</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">© {SITE_NAME}</div>
    </footer>
  );
}
