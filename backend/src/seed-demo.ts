import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

/**
 * Demo data for manual testing. Idempotent.
 *   node dist/seed-demo.js           create / top up demo data
 *   node dist/seed-demo.js --reset   remove everything this script created
 *
 * Demo users all live under @demo.test. Only the demo teacher and demo student
 * get usable passwords (DEMO_TEACHER_PASSWORD / DEMO_STUDENT_PASSWORD in .env);
 * the filler students get random passwords nobody knows.
 * Payment numbers (Setting) are deliberately NOT seeded: a fake number on the
 * public checkout could mislead real visitors into sending money to it.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DOMAIN = '@demo.test';
const TEACHER_EMAIL = `teacher${DOMAIN}`;
const STUDENT_EMAIL = `student${DOMAIN}`;

const COURSE_TITLES = [
  'HSC পদার্থবিজ্ঞান ২০২৭',
  'SSC গণিত ফাউন্ডেশন',
  'ইংলিশ স্পোকেন (ফ্রি)',
  'HSC রসায়ন ২০২৭',
];
const GLOBAL_NOTICE_TITLES = ['নতুন সেশনে স্বাগতম', 'মডেল টেস্টের তারিখ'];

const SAMPLE_VIDEO = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // Big Buck Bunny (CC)
const SAMPLE_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

const daysAgo = (d: number, hour = 12) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 0, 0, 0);
  return t;
};
const inHours = (h: number) => new Date(Date.now() + h * 3600_000);

async function reset() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.attempt.deleteMany({ where: { userId: { in: ids } } });
  await prisma.enrollment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.batch.deleteMany({ where: { title: { in: COURSE_TITLES } } });
  await prisma.notice.deleteMany({ where: { batchId: null, title: { in: GLOBAL_NOTICE_TITLES } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log('Demo data removed.');
}

async function user(email: string, name: string, opts: { role?: 'TEACHER' | 'STUDENT'; password?: string; phone?: string; createdAt?: Date; permissions?: string[] }) {
  const passwordHash = await bcrypt.hash(opts.password ?? randomBytes(24).toString('hex'), 10);
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      phone: opts.phone ?? null,
      role: opts.role ?? 'STUDENT',
      passwordHash,
      permissions: opts.permissions ?? [],
      createdAt: opts.createdAt,
    },
    // Re-running keeps role/permissions in sync and resets the known passwords.
    update: {
      name,
      role: opts.role ?? 'STUDENT',
      permissions: opts.permissions ?? [],
      isActive: true,
      ...(opts.password ? { passwordHash } : {}),
    },
  });
}

async function seed() {
  const teacherPw = process.env.DEMO_TEACHER_PASSWORD;
  const studentPw = process.env.DEMO_STUDENT_PASSWORD;
  if (!teacherPw || !studentPw) throw new Error('Set DEMO_TEACHER_PASSWORD and DEMO_STUDENT_PASSWORD in .env');

  // ---- people ----
  // The teacher gets everything EXCEPT payment.manage, so permission gating is testable.
  const teacher = await user(TEACHER_EMAIL, 'ডেমো শিক্ষক', {
    role: 'TEACHER',
    password: teacherPw,
    phone: '01700000001',
    permissions: ['content.manage', 'exam.manage', 'live.manage', 'routine.manage', 'notice.manage', 'student.view'],
  });
  const demo = await user(STUDENT_EMAIL, 'ডেমো শিক্ষার্থী', { password: studentPw, phone: '01800000001', createdAt: daysAgo(10) });

  const names = ['আরিফ হোসেন', 'সাদিয়া ইসলাম', 'নাফিস আহমেদ', 'তাসনিম জাহান', 'রাকিব হাসান', 'মিম আক্তার', 'ফাহিম রহমান', 'নুসরাত জাহান'];
  const fillers = [];
  for (let i = 0; i < names.length; i++) {
    fillers.push(await user(`s${i + 1}${DOMAIN}`, names[i], { phone: `0190000000${i + 1}`, createdAt: daysAgo(28 - i * 3, 9 + i) }));
  }
  const [s1, s2, s3, s4, s5, s6, s7] = fillers;

  // ---- courses ----
  const existing = new Set((await prisma.batch.findMany({ where: { title: { in: COURSE_TITLES } }, select: { title: true } })).map((b) => b.title));
  const course = async (data: Parameters<typeof prisma.batch.create>[0]['data']) =>
    existing.has(data.title as string)
      ? prisma.batch.findFirstOrThrow({ where: { title: data.title as string } })
      : prisma.batch.create({ data });
  const fresh = (t: string) => !existing.has(t);

  const physics = await course({
    title: COURSE_TITLES[0],
    subtitle: 'বেসিক থেকে অ্যাডভান্সড — সাপ্তাহিক পরীক্ষাসহ পূর্ণাঙ্গ প্রস্তুতি',
    description: 'পূর্ণাঙ্গ সিলেবাস কভার, সাপ্তাহিক পরীক্ষা ও রেকর্ডেড ক্লাস।\nপ্রতিটি অধ্যায়ের শেষে মডেল টেস্ট।',
    duration: '৬ মাস',
    highlights: ['ভেক্টর ও গতিবিদ্যা সম্পূর্ণ আয়ত্ত', 'তাপগতিবিদ্যার গাণিতিক সমস্যা সমাধান', 'সাপ্তাহিক MCQ পরীক্ষা ও বিশ্লেষণ', 'রেকর্ডেড ক্লাস যখন খুশি দেখা'],
    isPaid: true,
    fee: 2500,
  });
  const math = await course({
    title: COURSE_TITLES[1],
    subtitle: 'বীজগণিত ও জ্যামিতি — বেসিক থেকে অ্যাডভান্সড',
    description: 'SSC পরীক্ষার জন্য গণিতের পূর্ণাঙ্গ প্রস্তুতি। প্রতি ক্লাসে অনুশীলনী সমাধান।',
    duration: '৪ মাস',
    highlights: ['বীজগণিতের সূত্র ও প্রয়োগ', 'জ্যামিতির উপপাদ্য সহজ ভাষায়', 'প্রতিটি অধ্যায়ের অনুশীলন'],
    isPaid: true,
    fee: 1500,
  });
  const english = await course({
    title: COURSE_TITLES[2],
    subtitle: 'প্রতিদিনের কথোপকথনের জন্য ফ্রি কোর্স',
    description: 'দৈনন্দিন ইংরেজি বলা ও বোঝার আত্মবিশ্বাস গড়ে তুলুন।',
    duration: '২ মাস',
    highlights: ['সহজ বাক্য গঠন', 'প্রতিদিনের কাজে ব্যবহৃত শব্দভান্ডার', 'উচ্চারণ অনুশীলন'],
    isPaid: false,
    fee: 0,
  });
  // No teacher is assigned to this one on purpose (empty-state + scoping tests).
  const chemistry = await course({
    title: COURSE_TITLES[3],
    subtitle: 'জৈব ও অজৈব রসায়ন — গোছানো প্রস্তুতি',
    description: 'অধ্যায়ভিত্তিক ক্লাস ও নোট।',
    duration: '৬ মাস',
    highlights: ['পর্যায় সারণি ও রাসায়নিক বন্ধন', 'জৈব রসায়নের বিক্রিয়া'],
    isPaid: true,
    fee: 2000,
  });

  // The teacher is assigned to physics + english only.
  for (const b of [physics, english]) {
    await prisma.batchTeacher.upsert({
      where: { batchId_userId: { batchId: b.id, userId: teacher.id } },
      create: { batchId: b.id, userId: teacher.id },
      update: {},
    });
  }

  // ---- enrolments & payments ----
  let n = 0;
  const enroll = async (u: { id: string }, b: { id: string; fee: number }, status: 'ACTIVE' | 'PENDING' | 'REJECTED', daysBack: number) => {
    const createdAt = daysAgo(daysBack, 11);
    const e = await prisma.enrollment.upsert({
      where: { userId_batchId: { userId: u.id, batchId: b.id } },
      create: { userId: u.id, batchId: b.id, status, createdAt },
      update: {},
    });
    if (b.fee > 0 && (await prisma.payment.count({ where: { enrollmentId: e.id } })) === 0) {
      n++;
      await prisma.payment.create({
        data: {
          enrollmentId: e.id,
          amount: b.fee,
          method: n % 2 ? 'bKash' : 'Nagad',
          trxId: `DEMO${String(n).padStart(4, '0')}${randomBytes(2).toString('hex').toUpperCase()}`,
          status: status === 'ACTIVE' ? 'APPROVED' : status === 'PENDING' ? 'PENDING' : 'REJECTED',
          createdAt,
        },
      });
    }
  };

  if (fresh(COURSE_TITLES[0])) {
    await enroll(demo, physics, 'ACTIVE', 9);
    await enroll(s1, physics, 'ACTIVE', 22);
    await enroll(s2, physics, 'ACTIVE', 17);
    await enroll(s3, physics, 'ACTIVE', 12);
    await enroll(s4, physics, 'PENDING', 1);
    await enroll(s5, physics, 'REJECTED', 5);
  }
  if (fresh(COURSE_TITLES[1])) {
    await enroll(demo, math, 'PENDING', 0); // demo student sees the "payment pending" state
    await enroll(s2, math, 'ACTIVE', 14);
    await enroll(s6, math, 'ACTIVE', 8);
    await enroll(s7, math, 'PENDING', 2);
  }
  if (fresh(COURSE_TITLES[2])) {
    await enroll(demo, english, 'ACTIVE', 10);
    for (let i = 0; i < fillers.length; i++) await enroll(fillers[i], english, 'ACTIVE', 26 - i * 3);
  }
  if (fresh(COURSE_TITLES[3])) {
    await enroll(s3, chemistry, 'ACTIVE', 6);
  }

  // ---- content (only for freshly created courses) ----
  if (fresh(COURSE_TITLES[0])) {
    await prisma.liveClass.createMany({
      data: [
        { batchId: physics.id, title: 'তাপগতিবিদ্যা — ক্লাস ০১', url: 'https://meet.google.com/abc-defg-hij', startsAt: inHours(-0.5), isLive: true },
        { batchId: physics.id, title: 'তাপগতিবিদ্যা — ক্লাস ০২', url: 'https://meet.google.com/abc-defg-hij', startsAt: inHours(26), isLive: false },
        { batchId: physics.id, title: 'ভেক্টর রিভিশন', url: 'https://meet.google.com/abc-defg-hij', startsAt: daysAgo(3, 10), isLive: false },
      ],
    });
    await prisma.routine.createMany({
      data: [
        { batchId: physics.id, dayOfWeek: 0, startTime: '10:00', endTime: '11:30', subject: 'পদার্থবিজ্ঞান ১ম পত্র' },
        { batchId: physics.id, dayOfWeek: 3, startTime: '18:00', endTime: '19:30', subject: 'পদার্থবিজ্ঞান ২য় পত্র' },
      ],
    });
    await prisma.material.createMany({
      data: [
        { batchId: physics.id, type: 'VIDEO', title: 'ভেক্টর পরিচিতি', url: SAMPLE_VIDEO },
        { batchId: physics.id, type: 'VIDEO', title: 'গতিবিদ্যার মূল ধারণা', url: SAMPLE_VIDEO },
        { batchId: physics.id, type: 'PDF', title: 'অধ্যায় ১ নোট', url: SAMPLE_PDF },
      ],
    });
    await prisma.notice.create({ data: { batchId: physics.id, title: 'নতুন অধ্যায় শুরু', body: 'তাপগতিবিদ্যা অধ্যায়ের ক্লাস শুরু হচ্ছে। সবাই নোট সাথে রাখবে।', createdAt: daysAgo(2) } });

    const exam = await prisma.exam.create({
      data: {
        batchId: physics.id,
        title: 'সাপ্তাহিক পরীক্ষা ১',
        durationMin: 10,
        published: true,
        questions: {
          create: [
            { text: 'বেগের SI একক কী?', options: ['m/s', 'm/s²', 'kg·m/s', 'N'], correctIndex: 0 },
            { text: 'বলের SI একক কী?', options: ['জুল', 'নিউটন', 'ওয়াট', 'প্যাসকেল'], correctIndex: 1 },
            { text: 'অভিকর্ষজ ত্বরণ g এর মান প্রায় কত?', options: ['৯.৮ m/s²', '১৯.৬ m/s²', '৯.৮ m/s', '৯.৮ N'], correctIndex: 0 },
            { text: 'কাজের SI একক কী?', options: ['নিউটন', 'জুল', 'ওয়াট', 'হার্টজ'], correctIndex: 1 },
            { text: 'ক্ষমতার SI একক কী?', options: ['ওয়াট', 'জুল', 'নিউটন', 'কুলম্ব'], correctIndex: 0 },
          ],
        },
      },
      include: { questions: true },
    });
    await prisma.exam.create({
      data: {
        batchId: physics.id,
        title: 'সাপ্তাহিক পরীক্ষা ২ (খসড়া)',
        durationMin: 15,
        published: false,
        questions: { create: [{ text: 'ভরবেগের একক কী?', options: ['kg·m/s', 'N', 'J', 'W'], correctIndex: 0 }] },
      },
    });
    // Attempts: `wrong` = how many questions this student gets wrong.
    const attempt = async (u: { id: string }, wrong: number) => {
      const answers: Record<string, number> = {};
      exam.questions.forEach((q, i) => (answers[q.id] = i < wrong ? (q.correctIndex + 1) % q.options.length : q.correctIndex));
      await prisma.attempt.create({
        data: { examId: exam.id, userId: u.id, answers, score: exam.questions.length - wrong, total: exam.questions.length, submittedAt: daysAgo(4) },
      });
    };
    await attempt(demo, 1);
    await attempt(s1, 0);
    await attempt(s2, 2);
    await attempt(s3, 3);
  }

  if (fresh(COURSE_TITLES[1])) {
    await prisma.routine.createMany({
      data: [
        { batchId: math.id, dayOfWeek: 1, startTime: '16:00', endTime: '17:30', subject: 'বীজগণিত' },
        { batchId: math.id, dayOfWeek: 4, startTime: '16:00', endTime: '17:30', subject: 'জ্যামিতি' },
      ],
    });
    await prisma.material.createMany({
      data: [
        { batchId: math.id, type: 'VIDEO', title: 'বীজগণিতের সূত্র', url: SAMPLE_VIDEO },
        { batchId: math.id, type: 'PDF', title: 'অনুশীলনী ১ সমাধান', url: SAMPLE_PDF },
      ],
    });
    await prisma.notice.create({ data: { batchId: math.id, title: 'ক্লাস টেস্ট', body: 'আগামী সোমবার বীজগণিতের ক্লাস টেস্ট হবে।', createdAt: daysAgo(1) } });
  }

  if (fresh(COURSE_TITLES[2])) {
    await prisma.liveClass.create({ data: { batchId: english.id, title: 'Spoken English — Lesson 1', url: 'https://meet.google.com/abc-defg-hij', startsAt: inHours(50), isLive: false } });
    await prisma.routine.create({ data: { batchId: english.id, dayOfWeek: 5, startTime: '16:00', endTime: '17:00', subject: 'Spoken English' } });
    await prisma.material.createMany({
      data: [
        { batchId: english.id, type: 'VIDEO', title: 'Greetings & Introductions', url: SAMPLE_VIDEO },
        { batchId: english.id, type: 'PDF', title: 'Common Phrases', url: SAMPLE_PDF },
      ],
    });
    const exam = await prisma.exam.create({
      data: {
        batchId: english.id,
        title: 'Grammar Quiz',
        durationMin: 5,
        published: true,
        questions: {
          create: [
            { text: 'She ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], correctIndex: 1 },
            { text: "Past tense of 'eat'?", options: ['eated', 'ate', 'eaten', 'eating'], correctIndex: 1 },
            { text: "Plural of 'child'?", options: ['childs', 'childes', 'children', 'childrens'], correctIndex: 2 },
            { text: "Opposite of 'hot'?", options: ['warm', 'cold', 'cool', 'boil'], correctIndex: 1 },
          ],
        },
      },
      include: { questions: true },
    });
    for (const [u, wrong] of [[s1, 0], [s2, 1]] as const) {
      const answers: Record<string, number> = {};
      exam.questions.forEach((q, i) => (answers[q.id] = i < wrong ? (q.correctIndex + 1) % q.options.length : q.correctIndex));
      await prisma.attempt.create({ data: { examId: exam.id, userId: u.id, answers, score: exam.questions.length - wrong, total: exam.questions.length, submittedAt: daysAgo(2) } });
    }
  }

  // Global notices (not tied to a course).
  for (const [title, body, d] of [
    ['নতুন সেশনে স্বাগতম', 'সব শিক্ষার্থীকে নতুন সেশনে স্বাগত। ক্লাস রুটিন কোর্স পেজে দেখে নিন।', 6],
    ['মডেল টেস্টের তারিখ', 'আগামী শুক্রবার সকাল ১০টায় সব ব্যাচের মডেল টেস্ট অনুষ্ঠিত হবে।', 1],
  ] as const) {
    if (!(await prisma.notice.findFirst({ where: { batchId: null, title } }))) {
      await prisma.notice.create({ data: { title, body, createdAt: daysAgo(d) } });
    }
  }

  console.log('Demo data ready.');
}

try {
  if (process.argv.includes('--reset')) await reset();
  else await seed();
} finally {
  await prisma.$disconnect();
}
