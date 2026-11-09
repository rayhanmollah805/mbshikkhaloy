/**
 * Fine-grained permissions an admin can grant to a teacher.
 * Admins implicitly hold all of them. Every permission is additionally
 * scoped to the batches the teacher is assigned to (see BatchTeacher).
 */
export const PERMISSIONS = [
  { key: 'content.manage', label: 'নোট ও ভিডিও আপলোড/মুছে ফেলা' },
  { key: 'exam.manage', label: 'পরীক্ষা তৈরি ও পাবলিশ' },
  { key: 'live.manage', label: 'লাইভ ক্লাস ম্যানেজ' },
  { key: 'routine.manage', label: 'ক্লাস রুটিন ম্যানেজ' },
  { key: 'notice.manage', label: 'নোটিশ দেওয়া' },
  { key: 'student.view', label: 'শিক্ষার্থী তালিকা ও ফলাফল দেখা' },
  { key: 'payment.manage', label: 'পেমেন্ট অনুমোদন' },
] as const;

export type Perm = (typeof PERMISSIONS)[number]['key'];
export const PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key);

/** Drops unknown strings and duplicates so junk never reaches the DB. */
export function cleanPermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((p): p is string => PERMISSION_KEYS.includes(p)))];
}
