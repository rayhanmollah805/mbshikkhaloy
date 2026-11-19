import { PrismaService } from '../prisma/prisma.service.js';

/** A student counts as present once they have watched this long. */
export const PRESENT_SECONDS = 120;

/** Progress numbers for the given students of one course (everyone when userIds is omitted). */
export async function batchStats(prisma: PrismaService, batchId: string, userIds?: string[]) {
  const userFilter = userIds ? { userId: { in: userIds } } : {};
  const [materials, exams, assignments, done, attempts, subs, live, att] = await Promise.all([
    prisma.material.count({ where: { batchId } }),
    prisma.exam.count({ where: { batchId, published: true } }),
    prisma.assignment.count({ where: { batchId } }),
    prisma.materialDone.findMany({ where: { ...userFilter, material: { batchId } }, select: { userId: true, materialId: true } }),
    prisma.attempt.findMany({ where: { ...userFilter, exam: { batchId, published: true } }, select: { userId: true, score: true, total: true } }),
    prisma.submission.findMany({ where: { ...userFilter, assignment: { batchId } }, select: { userId: true } }),
    prisma.liveClass.count({ where: { batchId, status: { in: ['LIVE', 'ENDED'] } } }),
    prisma.attendance.findMany({ where: { ...userFilter, seconds: { gte: PRESENT_SECONDS }, liveClass: { batchId } }, select: { userId: true } }),
  ]);
  const count = (rows: { userId: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.userId, (m.get(r.userId) ?? 0) + 1);
    return m;
  };
  const doneBy = count(done);
  const attBy = count(att);
  const subBy = count(subs);
  const attemptBy = new Map<string, { n: number; score: number; total: number }>();
  for (const a of attempts) {
    const c = attemptBy.get(a.userId) ?? { n: 0, score: 0, total: 0 };
    c.n++;
    c.score += a.score;
    c.total += a.total;
    attemptBy.set(a.userId, c);
  }
  const all = materials + exams + assignments;
  return (userId: string) => {
    const m = doneBy.get(userId) ?? 0;
    const e = attemptBy.get(userId)?.n ?? 0;
    const a = subBy.get(userId) ?? 0;
    const finished = Math.min(m, materials) + Math.min(e, exams) + Math.min(a, assignments);
    const t = attemptBy.get(userId);
    return {
      percent: all ? Math.round((finished / all) * 100) : 0,
      materials: { done: m, total: materials },
      exams: { done: e, total: exams },
      assignments: { done: a, total: assignments },
      classes: { attended: attBy.get(userId) ?? 0, total: live },
      examPct: t && t.total ? Math.round((t.score / t.total) * 100) : null,
      doneIds: undefined as string[] | undefined,
    };
  };
}
