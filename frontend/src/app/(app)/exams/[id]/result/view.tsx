"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Badge, Card, ErrorMsg, Skeleton, bn } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Result = {
  title: string;
  score: number;
  total: number;
  questions: { id: string; text: string; options: string[]; correctIndex: number; yourIndex: number | null }[];
};

export default function ResultPage() {
  const user = useRequireUser("STUDENT");
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Result>(`/exams/${id}/result`).then(setR).catch((e) => setError(e.message));
  }, [user, id]);

  if (!user) return null;
  const pct = r && r.total ? Math.round((r.score / r.total) * 100) : 0;

  return (
    <div className="fade-in mx-auto max-w-3xl">
      <Link href="/courses" className="mb-3 inline-flex text-sm font-medium text-brand hover:underline">
        ← আমার কোর্স
      </Link>
      <ErrorMsg error={error} />
      {!r && !error && <Skeleton className="h-40" />}
      {r && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-sub">ফলাফল</p>
              <h1 className="text-xl font-bold">{r.title}</h1>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-brand">
                {bn(r.score)}
                <span className="text-xl text-faint"> / {bn(r.total)}</span>
              </p>
              <p className="text-sm text-sub">{bn(pct)}%</p>
            </div>
          </Card>
          {r.questions.map((q, i) => {
            const ok = q.yourIndex === q.correctIndex;
            return (
              <Card key={q.id}>
                <p className="mb-3 flex items-start justify-between gap-3 font-semibold">
                  <span>
                    <span className="mr-2 text-brand">{bn(i + 1)}.</span>
                    {q.text}
                  </span>
                  {ok ? <Badge tone="green">সঠিক</Badge> : <Badge tone="red">{q.yourIndex === null ? "উত্তর নেই" : "ভুল"}</Badge>}
                </p>
                <ul className="space-y-1.5 text-[15px]">
                  {q.options.map((o, k) => {
                    const correct = k === q.correctIndex;
                    const mine = k === q.yourIndex;
                    return (
                      <li
                        key={k}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 ${correct ? "border-ok/30 bg-ok-soft text-ok" : mine ? "border-danger/30 bg-danger-soft text-danger" : "border-line text-sub"}`}
                      >
                        <span>{o}</span>
                        {/* Text + icon so correctness is never color-only. */}
                        <span className="flex items-center gap-1 text-xs font-semibold">
                          {correct && (
                            <>
                              <Icon name="check" className="size-4" /> সঠিক উত্তর
                            </>
                          )}
                          {mine && !correct && (
                            <>
                              <Icon name="x" className="size-4" /> আপনার উত্তর
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
