"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CourseCard, type Course } from "@/components/course-card";
import { Icon } from "@/components/icons";
import { ProfileModal } from "@/components/profile-modal";
import { Avatar, Badge, Card, EmptyState, ErrorMsg, Skeleton, bn, btnCls, fmtDate } from "@/components/ui";
import { api, fileUrl } from "@/lib/api";
import type { User } from "@/lib/auth";

type Dash = {
  profile: { name: string; email: string; phone: string | null; photoUrl: string | null; courses: number; examsTaken: number; avgPct: number | null; bestRank: { rank: number; of: number; course: string } | null };
  subjects: { course: string; pct: number }[];
  overallPct: number | null;
  focus: { course: string; progress: number; batchId: string } | null;
  lastResult: { exam: string; score: number; total: number; id: string } | null;
  upcomingExams: { id: string; title: string; course: string; durationMin: number; questions: number }[];
  assignments: { id: string; title: string; batchId: string; course: string; dueAt: string | null; maxMarks: number; submitted: boolean; marks: number | null; classPct: number }[];
  assignmentsTotal: number;
  upcomingClasses: { id: string; title: string; startsAt: string; endsAt: string | null; status: "SCHEDULED" | "LIVE"; course: string }[];
};
type Notice = { id: string; title: string; body: string; createdAt: string; batch: { title: string } | null };

const time = (d: string) => new Date(d).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" });
const day = (d: string) => new Date(d).toLocaleDateString("bn-BD", { day: "numeric", month: "short" });

/** Ring chart: `pct` of the circle filled. */
function Ring({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" role="img" aria-label={`${pct}% সম্পন্ন`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-line)" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-brand)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      <text x="40" y="40" textAnchor="middle" dominantBaseline="central" className="rotate-90 origin-center fill-ink text-[17px] font-bold" style={{ transformBox: "fill-box" }}>
        {bn(pct)}%
      </text>
    </svg>
  );
}

export function StudentDashboard({ user }: { user: User & { phone?: string | null } }) {
  const [d, setD] = useState<Dash | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    api<Dash>("/student/dashboard").then(setD).catch((e) => setError(e.message));
    api<Course[]>("/batches").then((all) => setCourses(all.filter((c) => c.enrollment?.status === "ACTIVE"))).catch(() => setCourses([]));
    api<Notice[]>("/notices").then((n) => setNotices(n.slice(0, 4))).catch(() => undefined);
  }, []);

  const first = user.name.split(" ")[0];
  const liveNow = d?.upcomingClasses.filter((c) => c.status === "LIVE") ?? [];
  const max = Math.max(100, ...(d?.subjects.map((s) => s.pct) ?? [0]));

  return (
    <div className="fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">স্বাগতম, {first}</h1>
        <p className="text-sub">আজ কী শিখবেন?</p>
      </div>
      <ErrorMsg error={error} />

      {liveNow.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger-soft p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-danger text-white">
              <Icon name="radio" />
            </span>
            <div>
              <p className="font-bold text-danger">এখন লাইভ চলছে</p>
              <p className="text-sm text-ink">
                {l.title} <span className="text-sub">· {l.course}</span>
              </p>
            </div>
          </div>
          <Link href={`/live/${l.id}`} className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Live Class এ যোগ দিন
          </Link>
        </div>
      ))}

      {!d && !error && <Skeleton className="h-96" />}
      {d && (
        <div className="grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)_18rem]">
          {/* ---------- left: upcoming exams ---------- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">
                আসন্ন পরীক্ষা <span className="text-faint">{bn(d.upcomingExams.length)}</span>
              </h2>
              <Link href="/courses" className="text-sm font-semibold text-brand hover:underline">সব কোর্স</Link>
            </div>
            {d.upcomingExams.length === 0 && <p className="rounded-xl border border-dashed border-line p-4 text-sm text-sub">এখন দেওয়ার মতো কোনো পরীক্ষা নেই।</p>}
            {d.upcomingExams.map((e) => (
              <Link key={e.id} href={`/exams/${e.id}`} className="block">
                <Card className="flex items-center gap-3 !p-3 transition-shadow hover:shadow-md">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon name="clipboard" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{e.title}</p>
                    <p className="truncate text-xs text-sub">{e.course} · {bn(e.questions)}টি প্রশ্ন · {bn(e.durationMin)} মিনিট</p>
                  </div>
                  <Icon name="arrow" className="size-4 shrink-0 text-brand" />
                </Card>
              </Link>
            ))}
            <div className="rounded-2xl bg-brand-soft p-5 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-surface text-brand">
                <Icon name="book" className="size-7" />
              </span>
              <p className="mt-3 font-bold">আরও কোর্সে ভর্তি হন</p>
              <p className="text-sm text-sub">নতুন কোর্স, লাইভ ক্লাস ও মডেল টেস্ট</p>
              <Link href="/browse" className="mx-auto mt-3 grid size-11 place-items-center rounded-full bg-brand text-white hover:bg-brand-dark" aria-label="কোর্স ভর্তি">
                <Icon name="arrow" />
              </Link>
            </div>
          </div>

          {/* ---------- center ---------- */}
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-soft p-5">
              <div>
                <h2 className="text-lg font-bold">আপনার ফলাফল দেখুন</h2>
                <p className="mt-1 max-w-md text-sm text-sub">কোর্সভিত্তিক পরীক্ষার নম্বর, অগ্রগতি, হাজিরা ও অ্যাসাইনমেন্টের রিপোর্ট কার্ড PDF হিসেবে নামিয়ে নিন।</p>
              </div>
              <Link href="/reports" className={`${btnCls} rounded-full px-6`}>
                PDF ডাউনলোড
              </Link>
            </div>

            <section>
              <h2 className="mb-3 text-lg font-bold">আমার অগ্রগতি</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <p className="text-sm text-sub">বিষয়ভিত্তিক গড় নম্বর</p>
                  <div className="mt-1 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-4xl font-bold">{d.overallPct === null ? "—" : `${bn(d.overallPct)}%`}</p>
                      {d.lastResult && (
                        <Link href={`/exams/${d.lastResult.id}/result`} className="mt-2 inline-block text-xs text-brand hover:underline">
                          শেষ পরীক্ষা: {d.lastResult.exam} — {bn(d.lastResult.score)}/{bn(d.lastResult.total)}
                        </Link>
                      )}
                    </div>
                    <div className="flex h-24 items-end gap-2" aria-label="বিষয়ভিত্তিক নম্বর">
                      {d.subjects.slice(0, 6).map((s) => (
                        <div key={s.course} className="flex w-6 flex-col items-center justify-end gap-1" title={`${s.course}: ${s.pct}%`}>
                          <div className="w-full rounded-t-md bg-brand" style={{ height: `${Math.max(6, (s.pct / max) * 88)}px`, opacity: 0.35 + (s.pct / 100) * 0.65 }} />
                        </div>
                      ))}
                      {d.subjects.length === 0 && <p className="text-xs text-faint">পরীক্ষা দিলে এখানে দেখা যাবে</p>}
                    </div>
                  </div>
                </Card>
                <Card className="flex items-center gap-4">
                  {d.focus ? (
                    <>
                      <Ring pct={d.focus.progress} />
                      <div className="min-w-0">
                        <p className="text-xs text-sub">কোর্স অগ্রগতি</p>
                        <p className="font-bold leading-snug">{d.focus.course}</p>
                        <Link href={`/batches/${d.focus.batchId}?tab=progress`} className="mt-1 inline-block text-xs text-brand hover:underline">
                          বিস্তারিত ও লিডারবোর্ড →
                        </Link>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-sub">কোর্সে ভর্তি হলে অগ্রগতি এখানে দেখা যাবে।</p>
                  )}
                </Card>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  অ্যাসাইনমেন্ট <span className="text-faint">{bn(d.assignmentsTotal)}</span>
                </h2>
              </div>
              {d.assignments.length === 0 && <EmptyState icon="clipboard" title="কোনো অ্যাসাইনমেন্ট নেই" hint="শিক্ষক হোমওয়ার্ক দিলে এখানে দেখা যাবে।" />}
              <div className="space-y-3">
                {d.assignments.map((a) => (
                  <Link key={a.id} href={`/batches/${a.batchId}?tab=assignments`} className="block">
                    <Card className="flex flex-wrap items-center gap-4 !p-3 transition-shadow hover:shadow-md">
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft font-bold text-brand">{a.title.trim().charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate text-sm font-bold">{a.title}</p>
                        <p className="truncate text-xs text-sub">{a.course}</p>
                      </div>
                      <div className="w-24 text-xs text-sub">
                        <p>জমার শেষ সময়</p>
                        <p className="font-semibold text-ink">{a.dueAt ? `${day(a.dueAt)}, ${time(a.dueAt)}` : "নেই"}</p>
                      </div>
                      <div className="w-32 text-xs text-sub">
                        <p>শ্রেণির জমা {bn(a.classPct)}%</p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${a.classPct}%` }} />
                        </div>
                      </div>
                      <div className="w-20 text-right text-sm">
                        {a.marks !== null ? <b>{bn(a.marks)}/{bn(a.maxMarks)}</b> : a.submitted ? <Badge tone="amber">যাচাই বাকি</Badge> : <Badge tone="red">জমা বাকি</Badge>}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* ---------- right: profile + classes ---------- */}
          <div className="space-y-6">
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-bold">আমার প্রোফাইল</h2>
                <button onClick={() => setEdit(true)} aria-label="প্রোফাইল সম্পাদনা" className="rounded-lg p-1.5 text-sub hover:bg-canvas">
                  <Icon name="edit" className="size-4" />
                </button>
              </div>
              <div className="flex flex-col items-center text-center">
                <Avatar name={d.profile.name} src={d.profile.photoUrl ? fileUrl(d.profile.photoUrl) : null} size="size-24" />
                <p className="mt-3 text-lg font-bold">{d.profile.name}</p>
                <p className="text-xs text-faint">{d.profile.phone ?? d.profile.email}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-canvas p-3 text-center">
                <div>
                  <p className="font-bold">{bn(d.profile.courses)}</p>
                  <p className="text-[11px] text-faint">কোর্স</p>
                </div>
                <div>
                  <p className="font-bold">{d.profile.avgPct === null ? "—" : `${bn(d.profile.avgPct)}%`}</p>
                  <p className="text-[11px] text-faint">গড় নম্বর</p>
                </div>
                <div title={d.profile.bestRank?.course}>
                  <p className="font-bold">{d.profile.bestRank ? `#${bn(d.profile.bestRank.rank)}` : "—"}</p>
                  <p className="text-[11px] text-faint">সেরা র‍্যাঙ্ক</p>
                </div>
              </div>
            </Card>

            <section>
              <h2 className="mb-3 font-bold">আসন্ন ক্লাস</h2>
              {d.upcomingClasses.length === 0 && <p className="rounded-xl border border-dashed border-line p-4 text-sm text-sub">কোনো ক্লাস নির্ধারিত নেই।</p>}
              <div className="space-y-3">
                {d.upcomingClasses.map((c) => (
                  <Link key={c.id} href={`/live/${c.id}`} className="block">
                    <Card className="flex items-center gap-3 !p-3 transition-shadow hover:shadow-md">
                      <div className="w-14 shrink-0 rounded-lg bg-canvas py-2 text-center">
                        <p className="text-sm font-bold">{time(c.startsAt)}</p>
                        <p className="text-[10px] text-faint">{day(c.startsAt)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{c.title}</p>
                        <p className="truncate text-xs">
                          {c.status === "LIVE" ? <span className="font-semibold text-danger">● এখন লাইভ</span> : <span className="font-semibold text-brand">অনলাইন</span>}
                          <span className="text-faint"> · {c.course}</span>
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ---------- below: courses + notices ---------- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">আমার কোর্স</h2>
          <Link href="/browse" className="text-sm font-semibold text-brand hover:underline">আরও কোর্স দেখুন →</Link>
        </div>
        {!courses && <Skeleton className="h-48" />}
        {courses?.length === 0 && <EmptyState icon="book" title="এখনো কোনো কোর্সে ভর্তি হননি" hint="“কোর্স ভর্তি” থেকে পছন্দের কোর্সে ভর্তি হন।" />}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses?.slice(0, 6).map((c) => <CourseCard key={c.id} course={c} />)}</div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">সাম্প্রতিক নোটিশ</h2>
          <Link href="/notices" className="text-sm font-semibold text-brand hover:underline">সব নোটিশ →</Link>
        </div>
        {notices.length === 0 ? (
          <p className="text-sm text-faint">কোনো নোটিশ নেই।</p>
        ) : (
          <div className="space-y-2">
            {notices.map((n) => (
              <Card key={n.id} className="py-3">
                <p className="font-semibold">{n.title}</p>
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-sub">{n.body}</p>
                <p className="mt-1 text-xs text-faint">{n.batch?.title ?? "সবার জন্য"} · {fmtDate(n.createdAt)}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {edit && <ProfileModal user={user} open onClose={() => setEdit(false)} />}
    </div>
  );
}
