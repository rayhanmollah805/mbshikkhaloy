"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmModal } from "@/components/confirm";
import { Icon } from "@/components/icons";
import { Card, ErrorMsg, Skeleton, bn, btnCls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Exam = {
  id: string;
  title: string;
  durationMin: number;
  questions: { id: string; text: string; options: string[] }[];
};

export default function TakeExam() {
  const user = useRequireUser("STUDENT");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submitted = useRef(false);
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!user) return;
    api<Exam>(`/exams/${id}`)
      .then((e) => {
        setExam(e);
        setLeft(e.durationMin * 60);
      })
      .catch((e) => setError(e.message));
  }, [user, id]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      await api(`/exams/${id}/submit`, { body: { answers: answersRef.current } });
      router.replace(`/exams/${id}/result`);
    } catch (e) {
      submitted.current = false;
      setBusy(false);
      setError(e instanceof Error ? e.message : "জমা ব্যর্থ");
    }
  }, [id, router]);

  // Countdown; auto-submit at zero.
  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      // Time is up: auto-submit once.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      submit();
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, submit]);

  if (!user) return null;
  const mm = left === null ? "" : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  const answered = Object.keys(answers).length;
  const total = exam?.questions.length ?? 0;
  const unanswered = total - answered;

  return (
    <div className="fade-in mx-auto max-w-3xl">
      <ErrorMsg error={error} />
      {!exam && !error && <Skeleton className="h-48" />}
      {exam && (
        <div className="space-y-4">
          <div className="sticky top-16 z-10 rounded-xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h1 className="truncate text-lg font-bold">{exam.title}</h1>
              <span
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-lg font-bold ${left !== null && left < 60 ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-dark"}`}
                role="timer"
                aria-label="বাকি সময়"
              >
                <Icon name="clock" className="size-5" /> {mm}
              </span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-canvas" aria-hidden="true">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-faint">
              {bn(answered)}/{bn(total)} উত্তর দেওয়া হয়েছে
            </p>
          </div>

          {exam.questions.map((q, i) => (
            <Card key={q.id}>
              <p className="mb-3 font-semibold">
                <span className="mr-2 text-brand">{bn(i + 1)}.</span>
                {q.text}
              </p>
              <div className="space-y-2" role="radiogroup" aria-label={`প্রশ্ন ${i + 1}`}>
                {q.options.map((o, k) => {
                  const on = answers[q.id] === k;
                  return (
                    <label key={k} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[15px] transition-colors ${on ? "border-brand bg-brand-soft" : "border-line hover:bg-canvas"}`}>
                      <input type="radio" className="size-4 accent-brand" name={q.id} checked={on} onChange={() => setAnswers({ ...answers, [q.id]: k })} />
                      {o}
                    </label>
                  );
                })}
              </div>
            </Card>
          ))}

          <button className={btnCls} disabled={busy} onClick={() => (unanswered === 0 ? submit() : setConfirmOpen(true))}>
            {busy ? "জমা হচ্ছে..." : "পরীক্ষা জমা দিন"}
          </button>
          <ConfirmModal open={confirmOpen} title="জমা দেবেন?" message={`${bn(unanswered)}টি প্রশ্নের উত্তর দেননি। এখন জমা দিলে আর বদলানো যাবে না।`} confirmLabel="জমা দিন" onConfirm={submit} onClose={() => setConfirmOpen(false)} />
        </div>
      )}
    </div>
  );
}
