"use client";

import Link from "next/link";
import { usePublic, type PublicCourse } from "@/lib/public";
import { PublicCourseCard } from "./public-course-card";
import { Skeleton, bn } from "./ui";

export function PopularCourses() {
  const { data, error } = usePublic<PublicCourse[]>("/public/courses");
  if (error) return null;
  if (!data) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    );
  }
  if (data.length === 0) {
    return <p className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sub">শীঘ্রই নতুন কোর্স আসছে।</p>;
  }
  const top = [...data].sort((a, b) => b.students - a.students).slice(0, 3);
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((c) => (
          <PublicCourseCard key={c.id} course={c} />
        ))}
      </div>
      {data.length > 3 && (
        <div className="mt-8 text-center">
          <Link href="/explore" className="font-semibold text-brand hover:underline">
            সব {bn(data.length)}টি কোর্স দেখুন →
          </Link>
        </div>
      )}
    </>
  );
}
