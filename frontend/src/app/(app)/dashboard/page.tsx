"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CourseCard, type Course } from "@/components/course-card";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, ErrorMsg, PageHeader, Skeleton, StatCard, bn, fmtDate } from "@/components/ui";
import { api } from "@/lib/api";
import { can, useRequireUser } from "@/lib/auth";

type Notice = { id: string; title: string; body: string; createdAt: string; batch: { title: string } | null };
type Live = { id: string; title: string; url: string; startsAt: string; isLive: boolean; course: string };

export default function Dashboard() {
  const user = useRequireUser("STUDENT", "TEACHER", "ADMIN");
  const router = useRouter();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [live, setLive] = useState<Live[]>([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role === "ADMIN") {
      router.replace("/admin");
      return;
    }
    (async () => {
      const [all, n] = await Promise.all([api<Course[]>("/batches"), api<Notice[]>("/notices")]);
      const mine = user.role === "STUDENT" ? all.filter((c) => c.enrollment?.status === "ACTIVE") : all;
      setCourses(mine);
      setNotices(n.slice(0, 4));
      const lives = await Promise.all(
        mine.map((c) =>
          api<Omit<Live, "course">[]>(`/batches/${c.id}/live`)
            .then((r) => r.filter((l) => l.isLive).map((l) => ({ ...l, course: c.title })))
            .catch(() => []),
        ),
      );
      setLive(lives.flat());
      if (can(user, "payment.manage")) setPending((await api<unknown[]>("/payments/pending")).length);
    })().catch((e) => setError(e.message));
  }, [user, router]);

  if (!user || user.role === "ADMIN") return null;
  const student = user.role === "STUDENT";
  const first = user.name.split(" ")[0];

  return (
    <div className="fade-in space-y-8">
      <PageHeader title={`স্বাগতম, ${first}`} subtitle={student ? "আজ কী শিখবেন?" : "আপনার অ্যাসাইন করা কোর্সগুলো"} />
      <ErrorMsg error={error} />

      {live.map((l) => (
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
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Live Class এ যোগ দিন
          </a>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="book" label={student ? "আমার কোর্স" : "অ্যাসাইন করা কোর্স"} value={courses ? bn(courses.length) : "…"} />
        <StatCard icon="radio" label="লাইভ চলছে" value={bn(live.length)} tone="amber" />
        {!student && can(user, "payment.manage") ? (
          <Link href="/payments">
            <StatCard icon="card" label="অপেক্ষমাণ পেমেন্ট" value={bn(pending)} tone="green" />
          </Link>
        ) : (
          <StatCard icon="bell" label="নতুন নোটিশ" value={bn(notices.length)} tone="slate" />
        )}
      </div>

      {!student && (
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-bold">
            <Icon name="shield" className="size-5 text-brand" /> আপনার অ্যাক্সেস
          </h2>
          {user.permissions.length === 0 ? (
            <p className="text-sm text-sub">অ্যাডমিন এখনো কোনো অ্যাক্সেস দেননি। আপনি কোর্স দেখতে পারবেন।</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {user.permissions.map((p) => (
                <Badge key={p} tone="brand">
                  {PERM_LABEL[p] ?? p}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{student ? "আমার কোর্স" : "আমার কোর্স"}</h2>
          <Link href={student ? "/browse" : "/courses"} className="text-sm font-semibold text-brand hover:underline">
            {student ? "আরও কোর্স দেখুন →" : "সব দেখুন →"}
          </Link>
        </div>
        {!courses && <Skeleton className="h-48" />}
        {courses?.length === 0 && (
          <EmptyState
            icon="book"
            title={student ? "এখনো কোনো কোর্সে ভর্তি হননি" : "আপনাকে কোনো কোর্স অ্যাসাইন করা হয়নি"}
            hint={student ? "“কোর্স ভর্তি” থেকে পছন্দের কোর্সে ভর্তি হন।" : "অ্যাডমিনের সাথে যোগাযোগ করুন।"}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses?.slice(0, 6).map((c) => <CourseCard key={c.id} course={c} />)}</div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">সাম্প্রতিক নোটিশ</h2>
          <Link href="/notices" className="text-sm font-semibold text-brand hover:underline">
            সব নোটিশ →
          </Link>
        </div>
        {notices.length === 0 ? (
          <p className="text-sm text-faint">কোনো নোটিশ নেই।</p>
        ) : (
          <div className="space-y-2">
            {notices.map((n) => (
              <Card key={n.id} className="py-3">
                <p className="font-semibold">{n.title}</p>
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-sub">{n.body}</p>
                <p className="mt-1 text-xs text-faint">
                  {n.batch?.title ?? "সবার জন্য"} · {fmtDate(n.createdAt)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const PERM_LABEL: Record<string, string> = {
  "content.manage": "নোট ও ভিডিও আপলোড",
  "exam.manage": "পরীক্ষা তৈরি",
  "live.manage": "লাইভ ক্লাস",
  "routine.manage": "ক্লাস রুটিন",
  "notice.manage": "নোটিশ",
  "student.view": "শিক্ষার্থী দেখা",
  "payment.manage": "পেমেন্ট অনুমোদন",
};
