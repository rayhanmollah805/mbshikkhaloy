"use client";

import Link from "next/link";
import { fileUrl } from "@/lib/api";
import { usePublic, type PublicCourse } from "@/lib/public";
import { PublicCourseCard } from "./public-course-card";
import { Avatar, Skeleton, bn } from "./ui";

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

type PublicTeacher = { id: string; name: string; designation: string | null; subject: string | null; photoUrl: string | null };

/** Faculty grid for the home page; renders nothing until at least one teacher exists. */
export function PublicTeachers() {
  const { data } = usePublic<PublicTeacher[]>("/public/teachers");
  if (!data) return <Skeleton className="h-56" />;
  if (data.length === 0) return null;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((t) => (
        <div key={t.id} className="flex flex-col items-center rounded-xl border border-line bg-surface p-6 text-center">
          <Avatar name={t.name} src={t.photoUrl ? fileUrl(t.photoUrl) : null} size="size-28" />
          <h3 className="mt-4 text-lg font-bold">{t.name}</h3>
          {t.designation && <p className="mt-0.5 text-sm font-semibold text-brand-dark">{t.designation}</p>}
          {t.subject && <p className="mt-2 text-sm text-sub">{t.subject}</p>}
        </div>
      ))}
    </div>
  );
}
