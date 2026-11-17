"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { PublicCourseCard } from "@/components/public-course-card";
import { EmptyState, ErrorMsg, Skeleton, bn, inputCls } from "@/components/ui";
import { usePublic, type PublicCourse } from "@/lib/public";

type Filter = "all" | "free" | "paid";

export default function Explore() {
  const { data, error } = usePublic<PublicCourse[]>("/public/courses");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter(
      (c) =>
        (filter === "all" || (filter === "free" ? !c.isPaid : c.isPaid)) &&
        (!s || `${c.title} ${c.subtitle ?? ""} ${c.teachers.join(" ")}`.toLowerCase().includes(s)),
    );
  }, [data, q, filter]);

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "সব" },
    { key: "free", label: "ফ্রি" },
    { key: "paid", label: "পেইড" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">সব কোর্স</h1>
      <p className="mt-1 text-sub">পছন্দের কোর্স খুঁজে নিন এবং ভর্তি হন।</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input className={`${inputCls} pl-9`} placeholder="কোর্স বা শিক্ষকের নাম খুঁজুন" aria-label="কোর্স খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div role="group" aria-label="ফিল্টার" className="flex gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              aria-pressed={filter === c.key}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${filter === c.key ? "border-brand bg-brand text-white" : "border-line bg-surface text-sub hover:bg-canvas"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {data && <span className="text-sm text-faint">{bn(shown.length)}টি কোর্স</span>}
      </div>

      <div className="mt-8">
        <ErrorMsg error={error} />
        {!data && !error && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        )}
        {data && shown.length === 0 && <EmptyState icon="search" title="কোনো কোর্স পাওয়া যায়নি" hint="অন্য নাম দিয়ে খুঁজুন বা ফিল্টার বদলান।" />}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <PublicCourseCard key={c.id} course={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
