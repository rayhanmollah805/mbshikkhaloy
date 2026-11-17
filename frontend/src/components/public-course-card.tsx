import Link from "next/link";
import type { PublicCourse } from "@/lib/public";
import { coverFor } from "./course-card";
import { Icon } from "./icons";
import { Badge, bn, taka } from "./ui";

export function PublicCourseCard({ course: c }: { course: PublicCourse }) {
  return (
    <Link
      href={`/explore/${c.slug ?? c.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className={`relative flex h-36 items-end overflow-hidden ${coverFor(c.id)} p-4`}>
        <span className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-12 left-8 size-28 rounded-full bg-white/10" aria-hidden="true" />
        <Icon name="book" className="absolute left-4 top-4 size-6 text-white/80" />
        <div className="absolute right-3 top-3">{c.isPaid ? <Badge tone="amber">{taka(c.fee)}</Badge> : <Badge tone="green">ফ্রি</Badge>}</div>
        <h3 className="relative line-clamp-2 text-lg font-bold leading-snug text-white">{c.title}</h3>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 min-h-11 text-sm text-sub">{c.subtitle || c.description || "বিস্তারিত দেখুন"}</p>
        {c.teachers.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-ink">
            <Icon name="teacher" className="size-4 text-brand" />
            <span className="truncate">{c.teachers.join(", ")}</span>
          </p>
        )}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-sub">
          {c.duration && (
            <li className="flex items-center gap-1">
              <Icon name="clock" className="size-3.5" /> {c.duration}
            </li>
          )}
          <li className="flex items-center gap-1">
            <Icon name="users" className="size-3.5" /> {bn(c.students)} জন
          </li>
          {c.materials > 0 && (
            <li className="flex items-center gap-1">
              <Icon name="video" className="size-3.5" /> {bn(c.materials)}টি নোট/ভিডিও
            </li>
          )}
          {c.exams > 0 && (
            <li className="flex items-center gap-1">
              <Icon name="clipboard" className="size-3.5" /> {bn(c.exams)}টি পরীক্ষা
            </li>
          )}
        </ul>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand group-hover:underline">
          বিস্তারিত দেখুন <Icon name="arrow" className="size-4" />
        </span>
      </div>
    </Link>
  );
}
