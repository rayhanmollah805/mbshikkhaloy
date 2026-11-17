"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePublic, type PublicCourse, type SiteInfo } from "@/lib/public";
import { useNotices } from "./home-header";
import { Icon, type IconName } from "./icons";
import { Skeleton, bn, taka } from "./ui";

const BG = [
  "from-green-900 to-green-600",
  "from-emerald-900 to-teal-600",
  "from-teal-900 to-green-600",
  "from-green-800 to-lime-700",
  "from-emerald-800 to-green-500",
];

type Slide = { key: string; badge: string; title: string; text: string; primary: { href: string; label: string }; secondary: { href: string; label: string } };

const WELCOME: Slide = {
  key: "welcome",
  badge: "স্বাগতম",
  title: "লাইভ ক্লাস, ভিডিও লেকচার, নোট ও পরীক্ষা — সব এক জায়গায়",
  text: "অনলাইনে ভর্তি হয়ে যেকোনো জায়গা থেকে পড়াশোনা করুন।",
  primary: { href: "/explore", label: "কোর্স দেখুন" },
  secondary: { href: "/register", label: "ফ্রি অ্যাকাউন্ট খুলুন" },
};

function Slider() {
  const { data } = usePublic<PublicCourse[]>("/public/courses");
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides: Slide[] =
    data && data.length > 0
      ? [...data]
          .sort((a, b) => b.students - a.students)
          .slice(0, 5)
          .map((c) => ({
            key: c.id,
            badge: c.isPaid ? `ফি ${taka(c.fee)}` : "ফ্রি কোর্স",
            title: c.title,
            text: c.subtitle || (c.teachers.length ? `শিক্ষক: ${c.teachers.join(", ")}` : "লাইভ ক্লাস, ভিডিও, নোট ও পরীক্ষাসহ পূর্ণাঙ্গ কোর্স"),
            primary: { href: `/explore/${c.slug ?? c.id}`, label: "ভর্তি তথ্য দেখুন" },
            secondary: { href: "/explore", label: "সব কোর্স" },
          }))
      : [WELCOME];
  const n = slides.length;
  const cur = Math.min(i, n - 1);

  // Auto-advance unless hovered/focused or the user prefers reduced motion.
  useEffect(() => {
    if (n < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const h = setInterval(() => setI((x) => (x + 1) % n), 5500);
    return () => clearInterval(h);
  }, [n, paused]);

  if (!data) return <Skeleton className="h-72 sm:h-96" />;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="বিশেষ কোর্স"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative h-[26rem] overflow-hidden rounded-2xl shadow-sm sm:h-96"
    >
      {slides.map((s, idx) => (
        <div
          key={s.key}
          role="group"
          aria-roledescription="slide"
          aria-label={`${idx + 1} / ${n}`}
          aria-hidden={idx !== cur}
          inert={idx !== cur}
          className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-br px-5 pb-14 pt-6 transition-opacity duration-500 sm:px-16 sm:pb-12 sm:pt-10 ${BG[idx % BG.length]} ${idx === cur ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <span className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-white/10" aria-hidden="true" />
          <span className="pointer-events-none absolute -bottom-24 right-24 size-56 rounded-full bg-white/10" aria-hidden="true" />
          <span className="relative mb-3 w-fit rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white">{s.badge}</span>
          <h2 className="relative line-clamp-3 max-w-2xl text-2xl font-bold leading-snug text-white sm:text-4xl">{s.title}</h2>
          <p className="relative mt-2 line-clamp-2 max-w-xl text-green-50 sm:text-lg">{s.text}</p>
          <div className="relative mt-5 flex flex-wrap gap-3">
            <Link href={s.primary.href} className="inline-flex min-h-11 items-center rounded-lg bg-white px-5 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-soft">
              {s.primary.label}
            </Link>
            <Link href={s.secondary.href} className="inline-flex min-h-11 items-center rounded-lg border border-white/60 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/15">
              {s.secondary.label}
            </Link>
          </div>
        </div>
      ))}

      {n > 1 && (
        <>
          <button onClick={() => setI((cur - 1 + n) % n)} aria-label="আগের স্লাইড" className="absolute left-3 top-4 grid size-9 sm:top-1/2 sm:size-10 sm:-translate-y-1/2 place-items-center rounded-full bg-white/85 text-brand-dark shadow transition-colors hover:bg-white">
            <Icon name="arrow" className="size-5 rotate-180" />
          </button>
          <button onClick={() => setI((cur + 1) % n)} aria-label="পরের স্লাইড" className="absolute right-3 top-4 grid size-9 sm:top-1/2 sm:size-10 sm:-translate-y-1/2 place-items-center rounded-full bg-white/85 text-brand-dark shadow transition-colors hover:bg-white">
            <Icon name="arrow" className="size-5" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1" role="group" aria-label="স্লাইড বেছে নিন">
            {slides.map((s, idx) => (
              <button key={s.key} onClick={() => setI(idx)} aria-label={`স্লাইড ${idx + 1}`} aria-current={idx === cur} className="grid size-6 place-items-center">
                <span className={`size-2.5 rounded-full border border-white transition-colors ${idx === cur ? "bg-white" : "bg-transparent"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function NoticeBoard() {
  const { items, isAnnouncement, loaded } = useNotices();
  return (
    <aside aria-label="নোটিশ বোর্ড" className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm lg:h-96">
      <h2 className="flex items-center gap-2 bg-brand px-4 py-3 font-bold text-white">
        <Icon name="bell" className="size-5" /> নোটিশ বোর্ড
      </h2>
      <ul className="flex-1 divide-y divide-line overflow-y-auto">
        {!loaded && <li className="p-4"><Skeleton className="h-24" /></li>}
        {loaded && items.length === 0 && <li className="p-6 text-center text-sm text-sub">এখনো কোনো নোটিশ নেই।</li>}
        {items.map((n, idx) => (
          <li key={idx} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <Icon name="file" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium leading-snug text-ink">{n.text}</p>
              <span className="mt-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">{isAnnouncement ? "নোটিশ" : "নতুন কোর্স"}</span>
            </div>
            {n.href && (
              <Link href={n.href} className="shrink-0 rounded-md border border-brand-line px-2.5 py-1 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-soft">
                বিস্তারিত
              </Link>
            )}
          </li>
        ))}
      </ul>
      <Link href="/explore" className="border-t border-line px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">
        সব কোর্স দেখুন →
      </Link>
    </aside>
  );
}

export function HomeHero() {
  return (
    <section className="mx-auto max-w-6xl px-3 pb-8 pt-4 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Slider />
        <NoticeBoard />
      </div>
    </section>
  );
}

/** Real counts only; a tile is hidden while its number is zero. */
export function StatsBand() {
  const { data } = usePublic<SiteInfo>("/public/site");
  const all: { n: number; label: string; icon: IconName }[] = [
    { n: data?.stats.students ?? 0, label: "মোট শিক্ষার্থী", icon: "users" },
    { n: data?.stats.courses ?? 0, label: "কোর্স", icon: "book" },
    { n: data?.stats.teachers ?? 0, label: "শিক্ষক", icon: "teacher" },
  ];
  const items = all.filter((x) => x.n > 0);
  if (items.length === 0) return null;
  return (
    <section className="bg-brand" aria-label="পরিসংখ্যান">
      <dl className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-3 sm:px-6">
        {items.map((s) => (
          <div key={s.label} className="flex items-center gap-4 rounded-xl bg-white/10 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15 text-white">
              <Icon name={s.icon} className="size-6" />
            </span>
            <div>
              <dd className="text-3xl font-bold leading-none text-white">{bn(s.n)}+</dd>
              <dt className="mt-1 text-sm text-green-100">{s.label}</dt>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
