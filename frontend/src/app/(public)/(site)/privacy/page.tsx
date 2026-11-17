import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: `Privacy Policy — ${SITE_NAME}` };

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-[15px] leading-relaxed text-ink sm:px-6">
      <h1 className="text-3xl font-bold">Privacy Policy / গোপনীয়তা নীতি</h1>
      <p className="text-sub">Last updated: 11 November 2026</p>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">1. Who we are</h2>
        <p>{SITE_NAME} (Medhabikash Shikkhaloy) is an online coaching platform at https://mbshikkhaloy.com offering live classes, recorded lectures, notes and exams.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">2. Information we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account details: name, email address, phone number and a hashed password.</li>
          <li>Enrolment and payment records: the course you join and the payment method and reference you submit (we do not store card or wallet PINs).</li>
          <li>Learning activity: exam answers and results, class and notice access.</li>
          <li>Messages you send to the support desk and to the site's AI assistant.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">3. How we use it</h2>
        <p>To run your account and courses, verify payments, show your results, provide support, and keep the service secure. We do not sell your personal information and do not use it for advertising.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">4. YouTube and Google API Services</h2>
        <p>
          Live classes are streamed through YouTube. An administrator of {SITE_NAME} may connect the institution's own YouTube channel to this site. When they do, we request the
          YouTube scope <code>https://www.googleapis.com/auth/youtube</code> solely to create, start and end live broadcasts for our classes. We store the resulting refresh token on our server
          and use it only for that purpose. We do not read, collect or share any other YouTube or Google account data, and students are never asked to sign in to Google by this site.
        </p>
        <p>
          {SITE_NAME}'s use and transfer of information received from Google APIs adheres to the{" "}
          <a className="text-brand underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Videos you watch are served by YouTube and are subject to the{" "}
          <a className="text-brand underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Google Privacy Policy
          </a>{" "}
          and the{" "}
          <a className="text-brand underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
            YouTube Terms of Service
          </a>
          .
        </p>
        <p>
          An administrator can disconnect YouTube at any time from the site settings, and can revoke access at{" "}
          <a className="text-brand underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">5. Sharing</h2>
        <p>Course teachers can see the students enrolled in their courses. Questions you ask the AI assistant are processed by a third-party AI provider to produce an answer. We otherwise share data only if required by law.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">6. Retention and your choices</h2>
        <p>We keep data while your account is active. You may ask us to correct or delete your account and data through the support desk on this site.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">7. গোপনীয়তা (সংক্ষেপে)</h2>
        <p>
          আমরা আপনার নাম, ইমেইল, ফোন নম্বর, ভর্তি ও পেমেন্টের তথ্য এবং পরীক্ষার ফলাফল শুধু কোর্স পরিচালনা, পেমেন্ট যাচাই ও সহায়তার জন্য ব্যবহার করি। তথ্য বিক্রি করা হয় না।
          লাইভ ক্লাস YouTube এর মাধ্যমে দেখানো হয়; শিক্ষার্থীদের Google অ্যাকাউন্টের কোনো তথ্য আমরা সংগ্রহ করি না। তথ্য সংশোধন বা মুছতে সাইটের সাপোর্ট ব্যবহার করুন।
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">8. Contact</h2>
        <p>Questions about this policy: use the support chat on this website or the contact details in the site footer.</p>
      </section>
    </article>
  );
}
