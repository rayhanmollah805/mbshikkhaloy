"use client";

import Link from "next/link";
import { useState } from "react";
import { homeFor, useAuth } from "@/lib/auth";
import { parseAnnouncements, usePublic, type PublicCourse, type SiteInfo } from "@/lib/public";
import { SITE_NAME } from "@/lib/brand";
import { Icon } from "./icons";
import { LogoMark } from "./logo";

const NAV = [
  { href: "/", label: "হোম" },
  { href: "/explore", label: "কোর্স" },
  { href: "/#features", label: "সুবিধা" },
  { href: "/#how", label: "ভর্তি পদ্ধতি" },
  { href: "/#faq", label: "প্রশ্নোত্তর" },
  { href: "/#contact", label: "যোগাযোগ" },
];

/** What the ticker and notice board show: admin notices first, else the newest courses. */
export function useNotices() {
  const site = usePublic<SiteInfo>("/public/site").data;
  const courses = usePublic<PublicCourse[]>("/public/courses").data;
  const notices = parseAnnouncements(site?.settings.announcements);
  const fromCourses = (courses ?? []).slice(0, 6).map((c) => ({ text: `নতুন কোর্স: ${c.title}`, href: `/explore/${c.id}` }));
  const items = notices.length > 0 ? notices.map((text) => ({ text, href: null as string | null })) : fromCourses;
  return { items, isAnnouncement: notices.length > 0, loaded: !!site && !!courses };
}

function Ticker() {
  const { items } = useNotices();
  if (items.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((n, i) => (
        <li key={i} className="flex items-center whitespace-nowrap px-5 text-sm text-slate-100">
          <Icon name="bell" className="mr-2 size-4 text-amber-400" />
          {n.href ? (
            <Link href={n.href} tabIndex={hidden ? -1 : undefined} className="hover:underline">
              {n.text}
            </Link>
          ) : (
            n.text
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="bg-side">
      <div className="mx-auto flex max-w-6xl items-stretch">
        <span className="z-10 flex shrink-0 items-center bg-amber-600 px-4 text-sm font-bold text-white">নোটিশ</span>
        <div className="ticker min-w-0 flex-1 overflow-hidden py-2.5" role="region" aria-label="চলমান নোটিশ">
          {/* Two copies + translateX(-50%) = seamless loop; speed scales with length. */}
          <div className="ticker-track" style={{ ["--ticker-duration" as string]: `${Math.max(20, items.length * 9)}s` }}>
            {row(false)}
            {row(true)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeHeader() {
  const { user, loading } = useAuth();
  const { data } = usePublic<SiteInfo>("/public/site");
  const [open, setOpen] = useState(false);
  const name = data?.settings.siteName || SITE_NAME;
  const tagline = data?.settings.siteTagline;

  const brand = (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 py-2">
      <LogoMark className="size-10 shrink-0" light />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-lg font-bold text-white">{name}</span>
        {tagline && <span className="hidden truncate text-xs text-green-100 lg:block">{tagline}</span>}
      </span>
    </Link>
  );

  const cta = loading ? null : user ? (
    <Link href={homeFor(user.role)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
      <Icon name="home" className="size-4" /> ড্যাশবোর্ড
    </Link>
  ) : (
    <>
      <Link href="/register" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-700">
        <Icon name="edit" className="size-4" /> অনলাইন আবেদন
      </Link>
      <Link href="/login" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
        <Icon name="lock" className="size-4" /> লগইন
      </Link>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-40 bg-brand shadow-sm">
        <nav aria-label="প্রধান মেনু" className="mx-auto max-w-6xl px-2 sm:px-4 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="flex items-center justify-between gap-2 px-1 md:hidden">
            {brand}
            <button onClick={() => setOpen((o) => !o)} aria-label="মেনু খুলুন" aria-expanded={open} className="rounded-lg p-2 text-white hover:bg-white/10">
              <Icon name={open ? "x" : "menu"} />
            </button>
          </div>
          <div className="hidden min-w-0 md:block">{brand}</div>
          <ul className={`${open ? "flex" : "hidden"} flex-col gap-1 p-2 md:flex md:flex-row md:justify-center md:gap-1`}>
            {NAV.map((l, i) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors ${i === 0 ? "bg-white text-brand-dark" : "text-white hover:bg-white/15"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="mt-1 flex gap-2 border-t border-white/20 pt-3 md:hidden [&>a]:flex-1 [&>a]:justify-center [&>a:last-child]:bg-white [&>a:last-child]:text-brand-dark [&>a:last-child:hover]:bg-brand-soft">{cta}</li>
          </ul>
          <div className="hidden items-center justify-end gap-2 pr-2 md:flex [&>a:last-child]:bg-white [&>a:last-child]:text-brand-dark [&>a:last-child:hover]:bg-brand-soft">{cta}</div>
        </nav>
      </div>

      <Ticker />
    </>
  );
}
