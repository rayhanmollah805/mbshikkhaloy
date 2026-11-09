import type { AuthUser } from '../auth/auth.guard.js';
import { PERMISSIONS } from '../auth/permissions.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { readSettings } from '../public/public.controller.js';

/**
 * Builds the knowledge block the chatbot may answer from.
 *
 * PRIVACY MODEL: this text is sent to the model provider, so it only contains
 * what the asking person is already allowed to see in the app, and never:
 * password hashes, tokens, emails, phone numbers, Transaction IDs, file URLs
 * of paid content, exam answer keys, or other students' personal data.
 *  - guest   : public marketing data only
 *  - student : + their own enrolments, payments (status only), classes, notices, exams, scores
 *  - teacher : + their assigned courses, aggregate student/exam numbers (per permission)
 *  - admin   : + platform totals, teachers, per-course numbers, pending payments (names only)
 */

const DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const MAX_CONTEXT_CHARS = 28_000;
const fmt = (d: Date) =>
  d.toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' });
const taka = (n: number) => `৳${n}`;
/** Course titles/descriptions are admin-written text, not instructions; keep them single-line-ish. */
const clean = (s: string | null | undefined, max = 400) =>
  (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

async function publicSection(prisma: PrismaService) {
  const [courses, settings] = await Promise.all([
    prisma.batch.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        teachers: { select: { user: { select: { name: true } } } },
        routines: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        materials: { select: { type: true } },
        exams: { where: { published: true }, select: { id: true } },
        liveClasses: { select: { id: true } },
        _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
      },
    }),
    readSettings(prisma),
  ]);

  const methods = [
    settings.bkash && 'bKash',
    settings.nagad && 'Nagad',
    settings.rocket && 'Rocket',
    settings.bank && 'ব্যাংক ট্রান্সফার',
  ].filter(Boolean);

  const lines: string[] = [];
  lines.push('## সাইট');
  lines.push('নাম: আমাদের বিদ্যালয় (অনলাইন কোচিং: লাইভ ক্লাস, ভিডিও লেকচার, PDF নোট, MCQ পরীক্ষা, ক্লাস রুটিন, নোটিশ)।');
  lines.push('পেজ (শুধু এই লিংকগুলোই দেবে): /explore (সব কোর্স), প্রতিটি কোর্সের নির্দিষ্ট লিংক নিচে কোর্সের তালিকায় দেওয়া আছে (কখনো <...> প্লেসহোল্ডার লিখবে না, সবসময় আসল আইডিসহ লিংক দেবে), ভর্তি ও পেমেন্ট: কোর্সের চেকআউট লিংক, /register (শিক্ষার্থী অ্যাকাউন্ট), /login, /dashboard (আমার ড্যাশবোর্ড), /courses (আমার কোর্স), /notices (নোটিশ)।');
  lines.push(
    `ভর্তির নিয়ম: অ্যাকাউন্ট খুলুন → কোর্স পেজে "ভর্তি হন" → ফ্রি কোর্সে সাথে সাথে ভর্তি। পেইড কোর্সে চেকআউটে মেথড বেছে ফি পাঠিয়ে Transaction ID জমা দিন → শিক্ষক/অ্যাডমিন যাচাই করলে কোর্স খোলে। একই Transaction ID দুইবার ব্যবহার করা যায় না। পেমেন্ট মেথড: ${methods.length ? methods.join(', ') : 'এখনো সেট করা হয়নি'} (নম্বর চেকআউট পেজে দেখা যায়)।`,
  );
  lines.push('মানুষের সাহায্য: চ্যাট উইজেটের "সাপোর্ট" ট্যাবে বার্তা লিখলে সাপোর্ট টিম উত্তর দেয় (অ্যাকাউন্ট ছাড়াও লেখা যায়)। তুমি উত্তর দিতে না পারলে বা ব্যবহারকারী মানুষের সাথে কথা বলতে চাইলে এই ট্যাবের কথা বলবে।');
  if (settings.supportPhone || settings.supportEmail) {
    lines.push(`সাপোর্ট: ${[settings.supportPhone, settings.supportEmail].filter(Boolean).join(' / ')}`);
  }
  lines.push('');
  lines.push(`## কোর্স (${courses.length}টি, চালু আছে এমন)`);
  for (const c of courses) {
    lines.push(`- [আইডি ${c.id}] ${clean(c.title, 120)} — ${c.isPaid ? `ফি ${taka(c.fee)}` : 'ফ্রি'}`);
    lines.push(`  লিংক: কোর্স বিস্তারিত /explore/${c.id} · ভর্তি/পেমেন্ট /checkout/${c.id}`);
    if (c.subtitle) lines.push(`  সাবটাইটেল: ${clean(c.subtitle, 160)}`);
    if (c.description) lines.push(`  বিবরণ: ${clean(c.description)}`);
    if (c.duration) lines.push(`  সময়কাল: ${clean(c.duration, 60)}`);
    if (c.highlights.length) lines.push(`  যা শিখবেন: ${c.highlights.map((h) => clean(h, 160)).join('; ')}`);
    if (c.teachers.length) lines.push(`  শিক্ষক: ${c.teachers.map((t) => clean(t.user.name, 60)).join(', ')}`);
    const videos = c.materials.filter((m) => m.type === 'VIDEO').length;
    lines.push(`  কনটেন্ট: ${videos}টি ভিডিও, ${c.materials.length - videos}টি PDF নোট, ${c.exams.length}টি পরীক্ষা, ${c.liveClasses.length}টি লাইভ ক্লাস; ${c._count.enrollments} জন শিক্ষার্থী`);
    if (c.routines.length) {
      lines.push(`  রুটিন: ${c.routines.map((r) => `${DAYS[r.dayOfWeek]} ${r.startTime}-${r.endTime} ${clean(r.subject, 60)}`).join('; ')}`);
    }
  }
  return lines;
}

async function studentSection(prisma: PrismaService, user: AuthUser) {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } });
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      batch: { select: { id: true, title: true } },
      payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { amount: true, method: true, status: true, createdAt: true } },
    },
  });
  const STATUS = { ACTIVE: 'ভর্তি সম্পন্ন', PENDING: 'পেমেন্ট যাচাই চলছে', REJECTED: 'পেমেন্ট বাতিল (আবার চেষ্টা করা যাবে)' } as const;
  const PAY = { APPROVED: 'অনুমোদিত', PENDING: 'অপেক্ষমাণ', REJECTED: 'বাতিল' } as const;

  const lines = ['', `## লগইন করা ব্যবহারকারী: শিক্ষার্থী "${clean(me.name, 60)}"`, '### আমার ভর্তি'];
  if (!enrollments.length) lines.push('- এখনো কোনো কোর্সে ভর্তি হননি।');
  for (const e of enrollments) {
    const p = e.payments[0];
    lines.push(`- [আইডি ${e.batch.id}] ${clean(e.batch.title, 120)} (কোর্স: /batches/${e.batch.id}, চেকআউট: /checkout/${e.batch.id}): ${STATUS[e.status]}${p ? ` (${taka(p.amount)}, ${p.method}, ${PAY[p.status]}, ${fmt(p.createdAt)})` : ''}`);
  }

  const active = enrollments.filter((e) => e.status === 'ACTIVE').map((e) => e.batch.id);
  if (active.length) {
    const titles = new Map(enrollments.map((e) => [e.batch.id, e.batch.title]));
    const [live, notices, materials, exams] = await Promise.all([
      prisma.liveClass.findMany({
        where: { batchId: { in: active }, OR: [{ isLive: true }, { startsAt: { gte: new Date(Date.now() - 864e5) } }] },
        orderBy: { startsAt: 'asc' },
        take: 12,
      }),
      prisma.notice.findMany({
        where: { OR: [{ batchId: null }, { batchId: { in: active } }] },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { batch: { select: { title: true } } },
      }),
      prisma.material.findMany({ where: { batchId: { in: active } }, select: { batchId: true, type: true, title: true } }),
      prisma.exam.findMany({
        where: { batchId: { in: active }, published: true },
        include: { _count: { select: { questions: true } }, attempts: { where: { userId: user.id }, select: { score: true, total: true } } },
      }),
    ]);
    lines.push('### আমার ক্লাস (লাইভ/আসন্ন)');
    if (!live.length) lines.push('- কোনো আসন্ন লাইভ ক্লাস নেই।');
    for (const l of live) {
      lines.push(`- ${clean(titles.get(l.batchId), 80)} · ${clean(l.title, 100)} · ${fmt(l.startsAt)} · ${l.isLive ? 'এখন LIVE — জয়েন লিংক: ' + l.url : 'এখনো শুরু হয়নি'}`);
    }
    lines.push('### নোটিশ');
    if (!notices.length) lines.push('- কোনো নোটিশ নেই।');
    for (const n of notices) lines.push(`- ${clean(n.title, 100)} (${n.batch?.title ?? 'সবার জন্য'}, ${fmt(n.createdAt)}): ${clean(n.body, 300)}`);
    lines.push('### কনটেন্ট (শুধু শিরোনাম; দেখতে কোর্স পেজে যান)');
    for (const m of materials) lines.push(`- ${clean(titles.get(m.batchId), 60)}: ${m.type === 'VIDEO' ? 'ভিডিও' : 'PDF'} — ${clean(m.title, 100)}`);
    lines.push('### পরীক্ষা');
    if (!exams.length) lines.push('- কোনো পরীক্ষা নেই।');
    for (const x of exams) {
      const a = x.attempts[0];
      lines.push(`- ${clean(titles.get(x.batchId), 60)}: ${clean(x.title, 100)} — ${x._count.questions}টি MCQ, ${x.durationMin} মিনিট, ${a ? `দিয়েছেন, স্কোর ${a.score}/${a.total}` : 'এখনো দেননি'}`);
    }
  }
  return lines;
}

async function teacherSection(prisma: PrismaService, user: AuthUser) {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } });
  const permLabel = (k: string) => PERMISSIONS.find((p) => p.key === k)?.label ?? k;
  const batches = await prisma.batch.findMany({
    where: { teachers: { some: { userId: user.id } } },
    include: { enrollments: { select: { status: true } }, exams: { include: { attempts: { select: { score: true, total: true } } } } },
  });
  const lines = ['', `## লগইন করা ব্যবহারকারী: শিক্ষক "${clean(me.name, 60)}"`];
  lines.push(`অ্যাক্সেস: ${user.permissions.length ? user.permissions.map(permLabel).join(', ') : 'কিছু না (শুধু কোর্স দেখা)'}`);
  lines.push('আপনার অ্যাসাইন করা কোর্স (শুধু এগুলোই আপনি ম্যানেজ করতে পারেন):');
  if (!batches.length) lines.push('- কোনো কোর্স অ্যাসাইন করা নেই।');
  const canView = user.permissions.includes('student.view');
  for (const b of batches) {
    const by = (s: string) => b.enrollments.filter((e) => e.status === s).length;
    lines.push(`- [আইডি ${b.id}] ${clean(b.title, 120)}${canView ? `: ${by('ACTIVE')} জন সক্রিয়, ${by('PENDING')} জন অপেক্ষমাণ` : ''}`);
    if (canView) {
      for (const x of b.exams) {
        const n = x.attempts.length;
        const avg = n ? (x.attempts.reduce((s, a) => s + a.score / Math.max(1, a.total), 0) / n) * 100 : 0;
        lines.push(`  পরীক্ষা "${clean(x.title, 80)}" (${x.published ? 'প্রকাশিত' : 'খসড়া'}): ${n}টি জমা${n ? `, গড় ${avg.toFixed(0)}%` : ''}`);
      }
    }
  }
  if (user.permissions.includes('payment.manage')) {
    const ids = batches.map((b) => b.id);
    const pending = await prisma.payment.count({ where: { status: 'PENDING', enrollment: { batchId: { in: ids } } } });
    lines.push(`অপেক্ষমাণ পেমেন্ট (আপনার কোর্সে): ${pending}টি — অনুমোদন: /payments`);
  }
  return lines;
}

async function adminSection(prisma: PrismaService, user: AuthUser) {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } });
  const [students, teachers, activeEnr, pendingCount, paid, batches, teacherRows, pending] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'TEACHER', isActive: true } }),
    prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.payment.findMany({ where: { status: 'APPROVED' }, select: { amount: true, enrollment: { select: { batchId: true } } } }),
    prisma.batch.findMany({
      include: { enrollments: { select: { status: true } }, teachers: { select: { user: { select: { name: true } } } } },
    }),
    prisma.user.findMany({
      where: { role: 'TEACHER' },
      select: { name: true, isActive: true, permissions: true, teaching: { select: { batch: { select: { title: true } } } } },
    }),
    prisma.payment.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { amount: true, method: true, createdAt: true, enrollment: { select: { user: { select: { name: true } }, batch: { select: { title: true } } } } },
    }),
  ]);
  const revenue = paid.reduce((s, p) => s + p.amount, 0);
  const revBy = new Map<string, number>();
  for (const p of paid) revBy.set(p.enrollment.batchId, (revBy.get(p.enrollment.batchId) ?? 0) + p.amount);

  const lines = ['', `## লগইন করা ব্যবহারকারী: অ্যাডমিন "${clean(me.name, 60)}" (সব অ্যাক্সেস)`];
  lines.push('অ্যাডমিন পেজ: /admin (ড্যাশবোর্ড), /admin/courses, /admin/teachers (শিক্ষক ও অ্যাক্সেস), /admin/students, /admin/payments, /admin/settings (পেমেন্ট নম্বর)।');
  lines.push(`### প্ল্যাটফর্ম: ${students} জন শিক্ষার্থী, ${teachers} জন সক্রিয় শিক্ষক, ${batches.length}টি কোর্স, ${activeEnr}টি সক্রিয় ভর্তি, মোট আয় ${taka(revenue)}, অপেক্ষমাণ পেমেন্ট ${pendingCount}টি`);
  lines.push('### কোর্স অনুযায়ী');
  for (const b of batches) {
    const by = (s: string) => b.enrollments.filter((e) => e.status === s).length;
    lines.push(`- ${clean(b.title, 100)} (${b.isActive ? 'চালু' : 'ভর্তি বন্ধ'}, ${b.isPaid ? taka(b.fee) : 'ফ্রি'}): সক্রিয় ${by('ACTIVE')}, অপেক্ষমাণ ${by('PENDING')}, বাতিল ${by('REJECTED')}, আয় ${taka(revBy.get(b.id) ?? 0)}, শিক্ষক: ${b.teachers.map((t) => clean(t.user.name, 40)).join(', ') || 'নেই'}`);
  }
  lines.push('### শিক্ষক');
  for (const t of teacherRows) {
    lines.push(`- ${clean(t.name, 60)} (${t.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}): কোর্স — ${t.teaching.map((x) => clean(x.batch.title, 60)).join(', ') || 'নেই'}; ${t.permissions.length}টি অ্যাক্সেস`);
  }
  lines.push('### অপেক্ষমাণ পেমেন্ট (সবচেয়ে পুরনো আগে)');
  if (!pending.length) lines.push('- নেই।');
  for (const p of pending) lines.push(`- ${clean(p.enrollment.user.name, 60)} → ${clean(p.enrollment.batch.title, 80)}: ${taka(p.amount)}, ${p.method}, ${fmt(p.createdAt)}`);
  return lines;
}

export async function buildContext(prisma: PrismaService, user: AuthUser | null): Promise<string> {
  const parts = await publicSection(prisma);
  if (user?.role === 'STUDENT') parts.push(...(await studentSection(prisma, user)));
  else if (user?.role === 'TEACHER') parts.push(...(await teacherSection(prisma, user)));
  else if (user?.role === 'ADMIN') parts.push(...(await adminSection(prisma, user)));
  else parts.push('', '## ব্যবহারকারী: অতিথি (লগইন করেননি)। ব্যক্তিগত তথ্য (ভর্তি, পেমেন্ট, স্কোর) দেখাতে লগইন করতে বলুন।');
  const text = parts.join('\n');
  return text.length > MAX_CONTEXT_CHARS ? text.slice(0, MAX_CONTEXT_CHARS) + '\n…(সংক্ষিপ্ত)' : text;
}
