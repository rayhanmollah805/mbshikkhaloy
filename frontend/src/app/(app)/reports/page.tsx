"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { ErrorMsg, PageHeader, Skeleton, bn, btnCls, fmtDate } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";
import { SITE_NAME } from "@/lib/brand";

type Row = {
  batchId: string;
  title: string;
  progress: number;
  examPct: number | null;
  exams: { done: number; total: number };
  materials: { done: number; total: number };
  assignments: { done: number; total: number };
  assignmentMarks: number;
  assignmentMax: number;
  classes: { attended: number; total: number };
  rank: number;
  students: number;
  certificate: string | null;
};
type Report = { student: { name: string; email: string; phone: string | null }; generatedAt: string; courses: Row[] };

export default function Reports() {
  const user = useRequireUser("STUDENT");
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (user) api<Report>("/student/report").then(setR).catch((e) => setError(e.message));
  }, [user]);
  if (!user) return null;
  return (
    <div className="fade-in">
      <div className="print:hidden">
        <PageHeader
          title="রিপোর্ট কার্ড"
          subtitle="কোর্সভিত্তিক ফলাফল ও অগ্রগতি"
          action={
            <button className={btnCls} onClick={() => window.print()}>
              PDF ডাউনলোড / প্রিন্ট
            </button>
          }
        />
      </div>
      <ErrorMsg error={error} />
      {!r && !error && <Skeleton className="h-64" />}
      {r && (
        <>
          <style>{`@page { size: A4; margin: 14mm } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } aside, header, #chat-widget { display: none !important } }`}</style>
          <article className="force-light rounded-2xl border border-line p-6 sm:p-8 print:border-0 print:p-0">
            <header className="mb-6 flex items-center gap-4 border-b-2 border-brand pb-4">
              <LogoMark className="size-14" />
              <div>
                <h2 className="text-xl font-bold text-brand-dark">{SITE_NAME}</h2>
                <p className="text-sm text-sub">শিক্ষার্থী রিপোর্ট কার্ড</p>
              </div>
              <p className="ml-auto text-right text-xs text-sub">
                তারিখ<br />
                <b className="text-ink">{fmtDate(r.generatedAt)}</b>
              </p>
            </header>
            <div className="mb-6 grid gap-1 text-sm sm:grid-cols-3">
              <p>
                <span className="text-sub">নাম:</span> <b>{r.student.name}</b>
              </p>
              <p>
                <span className="text-sub">মোবাইল:</span> <b>{r.student.phone ?? "—"}</b>
              </p>
              <p>
                <span className="text-sub">ইমেইল:</span> <b>{r.student.email}</b>
              </p>
            </div>
            {r.courses.length === 0 ? (
              <p className="text-sub">কোনো চলমান কোর্স নেই।</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-soft text-left text-brand-dark">
                      {["কোর্স", "অগ্রগতি", "পরীক্ষার গড়", "পরীক্ষা", "অ্যাসাইনমেন্ট", "হাজিরা", "র‍্যাঙ্ক"].map((h) => (
                        <th key={h} className="border border-line px-2 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.courses.map((c) => (
                      <tr key={c.batchId} className="align-top">
                        <td className="border border-line px-2 py-2 font-semibold">
                          {c.title}
                          {c.certificate && <div className="text-xs font-normal text-sub">সার্টিফিকেট: {c.certificate}</div>}
                        </td>
                        <td className="border border-line px-2 py-2">{bn(c.progress)}%</td>
                        <td className="border border-line px-2 py-2">{c.examPct === null ? "—" : `${bn(c.examPct)}%`}</td>
                        <td className="border border-line px-2 py-2">
                          {bn(c.exams.done)}/{bn(c.exams.total)}
                        </td>
                        <td className="border border-line px-2 py-2">
                          {bn(c.assignments.done)}/{bn(c.assignments.total)}
                          {c.assignmentMax > 0 && <div className="text-xs text-sub">নম্বর {bn(c.assignmentMarks)}/{bn(c.assignmentMax)}</div>}
                        </td>
                        <td className="border border-line px-2 py-2">
                          {bn(c.classes.attended)}/{bn(c.classes.total)}
                        </td>
                        <td className="border border-line px-2 py-2">
                          #{bn(c.rank)} / {bn(c.students)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-8 text-xs text-faint">এটি কম্পিউটার-জেনারেটেড রিপোর্ট। অগ্রগতি = সম্পন্ন নোট/ভিডিও + দেওয়া পরীক্ষা + জমা দেওয়া অ্যাসাইনমেন্ট।</p>
          </article>
        </>
      )}
    </div>
  );
}
