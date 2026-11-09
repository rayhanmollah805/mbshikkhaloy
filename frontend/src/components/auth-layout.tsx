import { SITE_NAME } from "@/lib/brand";
import { Icon, type IconName } from "./icons";
import { LogoMark } from "./logo";

const POINTS: { icon: IconName; text: string }[] = [
  { icon: "video", text: "লাইভ ক্লাস ও রেকর্ডেড ভিডিও লেকচার" },
  { icon: "file", text: "PDF নোট এক জায়গায়" },
  { icon: "clipboard", text: "MCQ পরীক্ষা ও তাৎক্ষণিক ফলাফল" },
  { icon: "calendar", text: "ক্লাস রুটিন ও নোটিশ" },
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-side p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" light />
          <span className="text-xl font-bold">{SITE_NAME}</span>
        </div>
        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight">
            শেখা হোক গুছিয়ে, <span className="text-teal-300">যেকোনো জায়গা থেকে।</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-slate-200">
                <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-teal-300">
                  <Icon name={p.icon} className="size-5" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-slate-400">© {SITE_NAME}</p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand/20" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 right-10 size-80 rounded-full bg-teal-400/10" aria-hidden="true" />
      </section>
      <section className="flex items-center justify-center bg-canvas p-6 sm:p-10">
        <div className="fade-in w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="size-9" />
            <span className="text-lg font-bold">{SITE_NAME}</span>
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-sub">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
