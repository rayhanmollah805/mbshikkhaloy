import Link from "next/link";
import { Icon } from "./icons";
import { Badge, bn, btnCls, taka } from "./ui";

export type Course = {
  id: string;
  title: string;
  description: string | null;
  isPaid: boolean;
  fee: number;
  billing?: "ONCE" | "MONTHLY";
  isActive: boolean;
  _count: { enrollments: number };
  teachers: { id: string; name: string }[];
  enrollment: { status: "PENDING" | "ACTIVE" | "REJECTED"; payment: string | null; accessUntil?: string | null } | null;
};

// Deterministic cover color per course so cards are recognisable at a glance.
const COVERS = ["bg-teal-700", "bg-indigo-700", "bg-amber-700", "bg-violet-700", "bg-sky-700", "bg-pink-700"];
// djb2 hash: spreads similar ids (cuid prefixes) across the palette better than a char sum.
export const coverFor = (id: string) =>
  COVERS[([...id].reduce((h, c) => (h * 33) ^ c.charCodeAt(0), 5381) >>> 0) % COVERS.length];

export function CourseCover({ course }: { course: Pick<Course, "id" | "title"> }) {
  return (
    <div className={`relative grid h-28 place-items-end overflow-hidden rounded-t-xl ${coverFor(course.id)} p-4`}>
      <span className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-10 left-6 size-24 rounded-full bg-white/10" aria-hidden="true" />
      <Icon name="book" className="absolute left-4 top-4 size-6 text-white/80" />
      <p className="relative line-clamp-2 w-full text-lg font-bold leading-snug text-white">{course.title}</p>
    </div>
  );
}

/** Course tile used on dashboards and the "my courses" list. */
export function CourseCard({ course, action }: { course: Course; action?: React.ReactNode }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md">
      <CourseCover course={course} />
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 min-h-10 text-sm text-sub">{course.description || "বিবরণ নেই"}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-sub">
          {course.isPaid ? <Badge tone="amber">{taka(course.fee)}{course.billing === "MONTHLY" ? "/মাস" : ""}</Badge> : <Badge tone="green">ফ্রি</Badge>}
          <span>{bn(course._count.enrollments)} জন শিক্ষার্থী</span>
          {course.enrollment?.accessUntil && (
            <Badge tone={new Date(course.enrollment.accessUntil).getTime() < Date.now() ? "red" : "slate"}>
              {new Date(course.enrollment.accessUntil).getTime() < Date.now() ? "মেয়াদ শেষ" : `মেয়াদ: ${new Date(course.enrollment.accessUntil).toLocaleDateString("bn-BD", { dateStyle: "medium" })}`}
            </Badge>
          )}
          {course.teachers.length > 0 && <span>· {course.teachers.map((t) => t.name).join(", ")}</span>}
        </div>
        <div className="mt-4">
          {action ?? (
            <Link href={`/batches/${course.id}`} className={btnCls}>
              কোর্সে যান
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
