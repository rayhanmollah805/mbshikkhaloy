import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: `Terms of Service — ${SITE_NAME}` };

export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-[15px] leading-relaxed text-ink sm:px-6">
      <h1 className="text-3xl font-bold">Terms of Service / ব্যবহারের শর্তাবলী</h1>
      <p className="text-sub">Last updated: 11 November 2026</p>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">1. Using the service</h2>
        <p>By creating an account or using {SITE_NAME} you agree to these terms. You must give accurate information and keep your password private. You are responsible for activity on your account.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">2. Courses and payments</h2>
        <p>Access to a paid course starts after your payment is verified and approved. Fees are shown on each course page. Refund requests are handled case by case through the support desk.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">3. Acceptable use</h2>
        <p>Do not share your login, copy or redistribute class recordings and notes, disrupt live classes or chat, or attempt to access other users' data. We may suspend accounts that break these rules.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">4. Live classes and YouTube</h2>
        <p>
          Live classes are delivered through YouTube and are also subject to the{" "}
          <a className="text-brand underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
            YouTube Terms of Service
          </a>
          . Chat in live classes is public to participants and must be respectful.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">5. AI assistant</h2>
        <p>The AI assistant gives general help about courses and may be wrong. Check fees, dates and other important details on the course page or with support.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">6. Changes and liability</h2>
        <p>The service is provided as is. We may update courses, features and these terms; continued use means you accept the changes. Our Privacy Policy explains how we handle your data.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">7. শর্তাবলী (সংক্ষেপে)</h2>
        <p>সঠিক তথ্য দিয়ে অ্যাকাউন্ট খুলুন, পাসওয়ার্ড গোপন রাখুন, ক্লাস রেকর্ডিং বা নোট অন্যকে শেয়ার করবেন না এবং লাইভ ক্লাস ও চ্যাটে শালীনতা বজায় রাখুন। পেইড কোর্সে পেমেন্ট অনুমোদনের পর প্রবেশাধিকার চালু হয়।</p>
      </section>
    </article>
  );
}
