"use client";

import { useEffect, useState } from "react";
import { CourseCard, type Course } from "@/components/course-card";
import { EmptyState, ErrorMsg, PageHeader, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

export default function MyCourses() {
  const user = useRequireUser("STUDENT", "TEACHER");
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<Course[]>("/batches")
      .then((all) => setCourses(user.role === "STUDENT" ? all.filter((c) => c.enrollment?.status === "ACTIVE") : all))
      .catch((e) => setError(e.message));
  }, [user]);

  if (!user) return null;
  return (
    <div className="fade-in">
      <PageHeader title="আমার কোর্স" />
      <ErrorMsg error={error} />
      {!courses && <Skeleton className="h-48" />}
      {courses?.length === 0 && <EmptyState icon="book" title="কোনো কোর্স নেই" hint={user.role === "STUDENT" ? "“কোর্স ভর্তি” থেকে ভর্তি হন।" : "অ্যাডমিন আপনাকে কোর্স অ্যাসাইন করলে এখানে দেখা যাবে।"} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses?.map((c) => <CourseCard key={c.id} course={c} />)}</div>
    </div>
  );
}
