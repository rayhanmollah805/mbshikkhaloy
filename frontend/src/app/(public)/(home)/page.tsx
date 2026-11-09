import type { Metadata } from "next";
import Link from "next/link";
import { HomeHero, StatsBand } from "@/components/home-hero";
import { PopularCourses } from "@/components/landing-islands";
import { Icon, type IconName } from "@/components/icons";

export const metadata: Metadata = {
  title: "আমাদের বিদ্যালয় — লাইভ ক্লাস, ভিডিও লেকচার, নোট ও পরীক্ষা",
  description: "অনলাইনে ভর্তি হয়ে লাইভ ক্লাস, রেকর্ডেড ভিডিও, PDF নোট ও MCQ পরীক্ষায় অংশ নিন — সব এক প্ল্যাটফর্মে।",
};

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "radio", title: "লাইভ ক্লাস", text: "ক্লাসের সময় হলে এক ক্লিকে Meet/Zoom এ যোগ দিন।" },
  { icon: "video", title: "রেকর্ডেড ভিডিও", text: "মিস হলেও চিন্তা নেই, যখন খুশি লেকচার দেখুন।" },
  { icon: "file", title: "PDF নোট", text: "শিক্ষকের তৈরি নোট এক জায়গায়, যেকোনো সময় ডাউনলোড।" },
  { icon: "clipboard", title: "MCQ পরীক্ষা", text: "টাইমারসহ পরীক্ষা দিন, সাথে সাথে ফলাফল ও সঠিক উত্তর দেখুন।" },
  { icon: "calendar", title: "ক্লাস রুটিন ও নোটিশ", text: "কখন কোন ক্লাস, আর নতুন ঘোষণা — সবসময় হাতের কাছে।" },
  { icon: "card", title: "সহজ পেমেন্ট", text: "bKash, Nagad বা Rocket এ পাঠিয়ে TrxID দিলেই হলো।" },
];

const STEPS = [
  { n: "১", title: "কোর্স বেছে নিন", text: "সব কোর্স থেকে পছন্দেরটি খুলে বিস্তারিত দেখুন।" },
  { n: "২", title: "ভর্তি ও পেমেন্ট", text: "ফ্রি কোর্সে সাথে সাথে ভর্তি। পেইড কোর্সে TrxID দিয়ে পেমেন্ট জমা দিন।" },
  { n: "৩", title: "শেখা শুরু করুন", text: "যাচাইয়ের পর কোর্স খুলে যাবে — ক্লাস, নোট ও পরীক্ষা সব সেখানে।" },
];

const FAQ = [
  { q: "কীভাবে ভর্তি হব?", a: "প্রথমে একটি শিক্ষার্থী অ্যাকাউন্ট খুলুন, তারপর পছন্দের কোর্সের পাতায় গিয়ে “ভর্তি হন” চাপুন।" },
  { q: "পেমেন্ট কীভাবে করব?", a: "চেকআউট পাতায় দেখানো bKash/Nagad/Rocket নম্বরে ফি পাঠান, তারপর Transaction ID লিখে জমা দিন।" },
  { q: "পেমেন্ট কখন যাচাই হয়?", a: "জমা দেওয়ার পর শিক্ষক/অ্যাডমিন Transaction ID মিলিয়ে অনুমোদন দেন। অনুমোদন হলেই কোর্স খুলে যায়।" },
  { q: "ফ্রি কোর্সেও কি অ্যাকাউন্ট লাগবে?", a: "হ্যাঁ। অ্যাকাউন্ট খুলে ফ্রি কোর্সে এক ক্লিকেই ভর্তি হওয়া যায়, কোনো পেমেন্ট লাগে না।" },
];

export default function Landing() {
  return (
    <>
      <HomeHero />
      <StatsBand />

      {/* Features */}
      <section id="features" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">শেখার জন্য যা যা দরকার</h2>
          <p className="mt-3 text-sub">আলাদা অ্যাপ বা গ্রুপে ঘোরাঘুরি নয় — সবকিছু একটাই জায়গায়।</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-6">
              <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon name={f.icon} className="size-6" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sub">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular courses */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">জনপ্রিয় কোর্স</h2>
              <p className="mt-1 text-sub">সবচেয়ে বেশি শিক্ষার্থী যেসব কোর্সে আছে</p>
            </div>
            <Link href="/explore" className="font-semibold text-brand hover:underline">
              সব কোর্স →
            </Link>
          </div>
          <PopularCourses />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight">ভর্তি হবেন যেভাবে</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="relative rounded-xl border border-line bg-surface p-6">
              <span className="grid size-11 place-items-center rounded-full bg-brand text-xl font-bold text-white">{s.n}</span>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sub">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">সাধারণ প্রশ্নোত্তর</h2>
          <div className="mt-8 divide-y divide-line rounded-xl border border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <Icon name="plus" className="size-5 shrink-0 text-brand transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sub">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-side">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-white">আজই শুরু করুন</h2>
          <p className="max-w-xl text-slate-300">একটি ফ্রি অ্যাকাউন্ট খুলুন, কোর্স দেখুন এবং পছন্দের কোর্সে ভর্তি হন।</p>
          <Link href="/register" className="inline-flex min-h-12 items-center rounded-lg bg-white px-7 text-base font-semibold text-brand-dark transition-colors hover:bg-brand-soft">
            ফ্রি অ্যাকাউন্ট খুলুন
          </Link>
        </div>
      </section>
    </>
  );
}
