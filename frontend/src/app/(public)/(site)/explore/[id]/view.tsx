"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { coverFor } from "@/components/course-card";
import { Icon } from "@/components/icons";
import { Badge, Card, DAYS, EmptyState, Skeleton, bn, btnCls, taka } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useEnrollState, usePublic, type PublicCourseDetail } from "@/lib/public";

export default function CourseDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: c, error } = usePublic<PublicCourseDetail>(`/public/courses/${id}`);

  useEffect(() => {
    if (c) document.title = `${c.title} — আমাদের বিদ্যালয়`;
  }, [c]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState icon="search" title="কোর্সটি পাওয়া যায়নি" hint="কোর্সটি বন্ধ থাকতে পারে বা লিংকটি ভুল।" />
        <div className="mt-6 text-center">
          <Link href="/explore" className={btnCls}>
            সব কোর্স দেখুন
          </Link>
        </div>
      </div>
    );
  }
  if (!c) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-44" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const videos = c.materials.filter((m) => m.type === "VIDEO");
  const notes = c.materials.filter((m) => m.type === "PDF");

  return (
    <>
      {/* Hero */}
      <section className={`relative overflow-hidden ${coverFor(c.id)}`}>
        <span className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-white/10" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:pr-[26rem]">
          <nav aria-label="ব্রেডক্রাম্ব" className="mb-4 text-sm text-white/80">
            <Link href="/explore" className="hover:underline">সব কোর্স</Link> <span aria-hidden="true">/</span> <span className="text-white">{c.title}</span>
          </nav>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">{c.title}</h1>
          {c.subtitle && <p className="mt-3 max-w-2xl text-lg text-white/90">{c.subtitle}</p>}
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90">
            {c.teachers.length > 0 && (
              <li className="flex items-center gap-1.5">
                <Icon name="teacher" className="size-4" /> {c.teachers.join(", ")}
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <Icon name="users" className="size-4" /> {bn(c.students)} জন শিক্ষার্থী
            </li>
            {c.duration && (
              <li className="flex items-center gap-1.5">
                <Icon name="clock" className="size-4" /> {c.duration}
              </li>
            )}
          </ul>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_22rem]">
        {/* Left column */}
        <div className="min-w-0 space-y-8 lg:order-1">
          {/* Mobile/tablet enrol card (desktop card is the sticky one) */}
          <div className="lg:hidden">
            <EnrollCard c={c} />
          </div>

          {c.highlights.length > 0 && (
            <Card>
              <h2 className="mb-4 text-xl font-bold">এই কোর্সে যা শিখবেন</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {c.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
                      <Icon name="check" className="size-3.5" />
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {c.description && (
            <Card>
              <h2 className="mb-3 text-xl font-bold">কোর্স সম্পর্কে</h2>
              <p className="whitespace-pre-wrap text-sub">{c.description}</p>
            </Card>
          )}

          <Card>
            <h2 className="mb-1 text-xl font-bold">কোর্স কনটেন্ট</h2>
            <p className="mb-4 text-sm text-sub">
              {bn(videos.length)}টি ভিডিও · {bn(notes.length)}টি নোট · {bn(c.exams.length)}টি পরীক্ষা · {bn(c.liveClasses)}টি লাইভ ক্লাস
            </p>
            {c.materials.length === 0 && c.exams.length === 0 ? (
              <p className="text-sm text-faint">কনটেন্ট শীঘ্রই যোগ করা হবে।</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {c.materials.map((m, i) => (
                  <li key={`m${i}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <Icon name={m.type === "VIDEO" ? "play" : "file"} className="size-4 shrink-0 text-brand" />
                    <span className="flex-1">{m.title}</span>
                    <Badge tone={m.type === "VIDEO" ? "red" : "brand"}>{m.type === "VIDEO" ? "ভিডিও" : "PDF"}</Badge>
                    <Icon name="lock" className="size-4 text-faint" />
                  </li>
                ))}
                {c.exams.map((e, i) => (
                  <li key={`e${i}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <Icon name="clipboard" className="size-4 shrink-0 text-brand" />
                    <span className="flex-1">{e.title}</span>
                    <span className="text-xs text-faint">
                      {bn(e.questions)}টি MCQ · {bn(e.durationMin)} মিনিট
                    </span>
                    <Icon name="lock" className="size-4 text-faint" />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
              <Icon name="lock" className="size-3.5" /> ভর্তির পর সব কনটেন্ট খুলে যাবে
            </p>
          </Card>

          {c.routines.length > 0 && (
            <Card>
              <h2 className="mb-4 text-xl font-bold">ক্লাস রুটিন</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {c.routines.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg border border-line p-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-center text-sm font-bold leading-tight text-brand-dark">{DAYS[r.dayOfWeek]}</span>
                    <div>
                      <p className="font-semibold">{r.subject}</p>
                      <p className="text-sm text-sub">
                        {r.startTime} – {r.endTime}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {c.teachers.length > 0 && (
            <Card>
              <h2 className="mb-4 text-xl font-bold">শিক্ষক</h2>
              <ul className="flex flex-wrap gap-3">
                {c.teachers.map((t) => (
                  <li key={t} className="flex items-center gap-3 rounded-full border border-line py-1.5 pl-1.5 pr-4">
                    <span className="grid size-9 place-items-center rounded-full bg-brand-soft font-bold text-brand-dark">{t.trim().charAt(0)}</span>
                    <span className="font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Sticky enrol card (desktop). Pulled up over the hero. */}
        <aside className="hidden lg:order-2 lg:block">
          <div className="sticky top-24 -mt-44">
            <EnrollCard c={c} />
          </div>
        </aside>
      </div>
    </>
  );
}

function EnrollCard({ c }: { c: PublicCourseDetail }) {
  const { user } = useAuth();
  const { status } = useEnrollState(c.id);
  const checkout = `/checkout/${c.id}`;

  let cta: React.ReactNode;
  if (status === "loading") cta = <div className="skeleton h-12" aria-hidden="true" />;
  else if (status === "ACTIVE")
    cta = (
      <Link href={`/batches/${c.id}`} className={`${btnCls} w-full min-h-12 text-base`}>
        কোর্সে যান
      </Link>
    );
  else if (status === "PENDING")
    cta = (
      <>
        <div className="rounded-lg bg-warn-soft px-3 py-2.5 text-center text-sm font-semibold text-warn">পেমেন্ট যাচাই চলছে</div>
        <Link href={checkout} className="mt-2 block text-center text-sm font-semibold text-brand hover:underline">
          অবস্থা দেখুন
        </Link>
      </>
    );
  else if (status === "staff")
    cta = <p className="rounded-lg bg-canvas px-3 py-2.5 text-center text-sm text-sub">শুধু শিক্ষার্থীরা ভর্তি হতে পারে</p>;
  else if (status === "guest")
    cta = (
      <>
        <Link href={`/register?next=${encodeURIComponent(checkout)}`} className={`${btnCls} w-full min-h-12 text-base`}>
          {c.isPaid ? "ভর্তি হন" : "ফ্রিতে ভর্তি হন"}
        </Link>
        <p className="mt-3 text-center text-sm text-sub">
          অ্যাকাউন্ট আছে?{" "}
          <Link href={`/login?next=${encodeURIComponent(checkout)}`} className="font-semibold text-brand hover:underline">
            লগইন
          </Link>
        </p>
      </>
    );
  else
    cta = (
      <Link href={checkout} className={`${btnCls} w-full min-h-12 text-base`}>
        {status === "REJECTED" ? "আবার পেমেন্ট করুন" : c.isPaid ? "ভর্তি হন" : "ফ্রিতে ভর্তি হন"}
      </Link>
    );

  const includes: { icon: "radio" | "video" | "file" | "clipboard"; text: string }[] = [
    { icon: "radio", text: `${bn(c.liveClasses)}টি লাইভ ক্লাস` },
    { icon: "video", text: `${bn(c.materials.filter((m) => m.type === "VIDEO").length)}টি ভিডিও লেকচার` },
    { icon: "file", text: `${bn(c.materials.filter((m) => m.type === "PDF").length)}টি PDF নোট` },
    { icon: "clipboard", text: `${bn(c.exams.length)}টি MCQ পরীক্ষা` },
  ];

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-lg">
      <p className="text-sm text-sub">কোর্স ফি</p>
      <p className="mb-4 text-4xl font-bold text-ink">{c.isPaid ? taka(c.fee) : "ফ্রি"}</p>
      {cta}
      <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
        {includes.map((i) => (
          <li key={i.text} className="flex items-center gap-2.5 text-ink">
            <Icon name={i.icon} className="size-4 text-brand" /> {i.text}
          </li>
        ))}
      </ul>
      {user === null && c.isPaid && <p className="mt-4 text-xs text-faint">পেমেন্ট bKash/Nagad/Rocket এ করা যাবে।</p>}
    </div>
  );
}
