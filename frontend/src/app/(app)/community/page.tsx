"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, ErrorMsg, PageHeader, Skeleton, bn, fmtDate, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Data = {
  courses: { id: string; title: string }[];
  doubts: { id: string; title: string; body: string; resolved: boolean; createdAt: string; author: string; authorRole: string; batchId: string; course: string; replies: number }[];
};

/** All questions from the student's courses in one place. */
export default function Community() {
  const user = useRequireUser("STUDENT");
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState("");
  useEffect(() => {
    if (user) api<Data>("/student/community").then(setD).catch((e) => setError(e.message));
  }, [user]);
  if (!user) return null;
  const rows = d?.doubts.filter((x) => !course || x.batchId === course) ?? [];
  return (
    <div className="fade-in">
      <PageHeader title="কমিউনিটি" subtitle="আপনার কোর্সগুলোর প্রশ্ন-উত্তর এক জায়গায়" />
      <ErrorMsg error={error} />
      {!d && !error && <Skeleton className="h-48" />}
      {d && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select className={`${inputCls} max-w-xs`} value={course} onChange={(e) => setCourse(e.target.value)} aria-label="কোর্স বাছুন">
              <option value="">সব কোর্স</option>
              {d.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            {d.courses.length > 0 && (
              <Link href={`/batches/${course || d.courses[0].id}?tab=doubts`} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                নতুন প্রশ্ন করুন
              </Link>
            )}
          </div>
          {rows.length === 0 && <EmptyState icon="chat" title="এখনো কোনো প্রশ্ন নেই" hint="কোনো কোর্সে গিয়ে প্রথম প্রশ্নটি করুন।" />}
          <div className="space-y-3">
            {rows.map((x) => (
              <Link key={x.id} href={`/batches/${x.batchId}?tab=doubts`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <p className="font-bold">
                    {x.title} {x.resolved && <Badge tone="green">সমাধান হয়েছে</Badge>}
                  </p>
                  <p className="line-clamp-2 text-sm text-sub">{x.body}</p>
                  <p className="mt-1 text-xs text-faint">
                    {x.author} · {x.course} · {fmtDate(x.createdAt)} · {bn(x.replies)}টি উত্তর
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
