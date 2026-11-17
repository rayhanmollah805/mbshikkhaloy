"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConfirmModal } from "@/components/confirm";
import { Icon } from "@/components/icons";
import { usePublic, type SiteInfo } from "@/lib/public";
import { Avatar, Badge, Card, EmptyState, ErrorMsg, Field, Modal, Skeleton, bn, btnCls, btnDanger, btnGhost, fmtDate, fmtDay, inputCls, taka } from "@/components/ui";
import { api, fileUrl, uploadFile, uploadSubmission } from "@/lib/api";
import { can, type User } from "@/lib/auth";

/** Loads data and offers `act` (run a write, then reload, report errors). */
function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<T>(path).then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), [path]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ব্যর্থ");
    }
  };
  return { data, error, act, load };
}

const Loading = () => <Skeleton className="h-24" />;

// =============================================================== Students
type Enr = {
  id: string;
  userId: string;
  status: string;
  accessUntil: string | null;
  createdAt: string;
  user: { name: string; email: string; phone: string | null };
  payments: { id: string; amount: number; method: string; trxId: string; status: string }[];
};
const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);

export function StudentsTab({ id, user }: { id: string; user: User }) {
  const { data: items, error, act } = useData<Enr[]>(`/batches/${id}/students`);
  const { data: att } = useData<{ total: number; attended: Record<string, number> }>(`/batches/${id}/attendance-summary`);
  const [q, setQ] = useState("");
  const [del, setDel] = useState<Enr | null>(null);
  const canPay = can(user, "payment.manage");
  const term = q.trim().toLowerCase();
  const shown = items?.filter((e) => !term || [e.user.name, e.user.phone ?? "", e.user.email, ...e.payments.map((p) => p.trxId)].some((v) => v.toLowerCase().includes(term)));
  return (
    <div className="space-y-3">
      <input className={inputCls} type="search" placeholder="নাম, মোবাইল, ইমেইল বা TrxID দিয়ে খুঁজুন…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorMsg error={error} />
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState icon="users" title="কোনো শিক্ষার্থী নেই" />}
      {items && items.length > 0 && shown?.length === 0 && <EmptyState icon="search" title="কাউকে পাওয়া যায়নি" />}
      {shown?.map((e) => {
        const left = e.accessUntil ? daysLeft(e.accessUntil) : null;
        return (
          <Card key={e.id} className="flex flex-wrap items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-bold">
                {e.user.name} <Badge tone={e.status === "ACTIVE" ? "green" : e.status === "PENDING" ? "amber" : "red"}>{e.status === "ACTIVE" ? "সক্রিয়" : e.status === "PENDING" ? "অপেক্ষমাণ" : "বাতিল"}</Badge>{" "}
                {left !== null && e.status === "ACTIVE" && <Badge tone={left < 0 ? "red" : left <= 7 ? "amber" : "slate"}>{left < 0 ? `মেয়াদ শেষ (${bn(-left)} দিন আগে)` : `মেয়াদ ${bn(left)} দিন`}</Badge>}
              </p>
              <p className="text-sub">{e.user.phone ?? e.user.email}</p>
              {att && att.total > 0 && e.status === "ACTIVE" && (
                <p className="text-xs text-sub">
                  হাজিরা: {bn(att.attended[e.userId] ?? 0)}/{bn(att.total)} ক্লাস
                </p>
              )}
              {e.payments.map((p) => (
                <p key={p.id} className="text-xs text-faint">
                  ৳{p.amount} · {p.method} · {p.trxId} · {p.status}
                </p>
              ))}
            </div>
            {canPay && (
              <div className="flex flex-wrap gap-2">
                {e.accessUntil && e.status === "ACTIVE" && (
                  <button className={btnGhost} onClick={() => act(() => api(`/batches/${id}/students/${e.id}/extend`, { body: { days: 30 } }))}>
                    +৩০ দিন
                  </button>
                )}
                <button className={btnDanger} onClick={() => setDel(e)}>
                  সরান
                </button>
              </div>
            )}
          </Card>
        );
      })}
      <ConfirmModal open={!!del} title="কোর্স থেকে সরাবেন?" message={`“${del?.user.name}” কে এই কোর্স থেকে সরানো হবে এবং তার পেমেন্ট রেকর্ডও মুছে যাবে।`} confirmLabel="সরান" onConfirm={() => del && act(() => api(`/batches/${id}/students/${del.id}`, { method: "DELETE" }))} onClose={() => setDel(null)} />
    </div>
  );
}

// =============================================================== Attendance
type AttRow = { userId: string; name: string; phone: string | null; seconds: number; present: boolean };
const mins = (s: number) => (s < 60 ? `${bn(s)} সেকেন্ড` : `${bn(Math.round(s / 60))} মিনিট`);

export function AttendanceModal({ liveId, onClose }: { liveId: string | null; onClose: () => void }) {
  const [d, setD] = useState<{ title: string; startsAt: string; present: number; total: number; rows: AttRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!liveId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD(null);
    setError(null);
    api<typeof d>(`/live/${liveId}/attendance`).then(setD).catch((e) => setError(e.message));
  }, [liveId]);
  const absent = d?.rows.filter((r) => !r.present) ?? [];
  return (
    <Modal open={!!liveId} title="হাজিরা" onClose={onClose} wide>
      <ErrorMsg error={error} />
      {!d && !error && <Loading />}
      {d && (
        <div className="space-y-4 text-sm">
          <p className="text-sub">
            <b className="text-ink">{d.title}</b> · {fmtDate(d.startsAt)}
          </p>
          <div className="flex gap-3">
            <Badge tone="green">উপস্থিত {bn(d.present)}</Badge>
            <Badge tone="red">অনুপস্থিত {bn(d.total - d.present)}</Badge>
            <span className="text-xs text-faint">কমপক্ষে ২ মিনিট দেখলে উপস্থিত ধরা হয়</span>
          </div>
          {d.rows.length === 0 && <p className="text-sub">কোনো সক্রিয় শিক্ষার্থী নেই।</p>}
          <div className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {d.rows.map((r) => (
              <div key={r.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {r.name} <span className="text-xs text-faint">{r.phone}</span>
                </span>
                {r.present ? <Badge tone="green">{mins(r.seconds)}</Badge> : <Badge tone="red">{r.seconds ? `মাত্র ${mins(r.seconds)}` : "অনুপস্থিত"}</Badge>}
              </div>
            ))}
          </div>
          {absent.length > 0 && (
            <button className={btnGhost} onClick={() => navigator.clipboard?.writeText(absent.map((r) => `${r.name} ${r.phone ?? ""}`.trim()).join("\n"))}>
              অনুপস্থিতদের তালিকা কপি করুন
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

// =============================================================== Assignments
type Sub = { id: string; userId: string; fileUrl: string | null; note: string | null; submittedAt: string; marks: number | null; feedback: string | null; gradedAt: string | null };
type Asg = { id: string; title: string; description: string | null; fileUrl: string | null; dueAt: string | null; maxMarks: number; createdAt: string; _count: { submissions: number }; submissions?: Sub[] };

export function AssignmentsTab({ id, user }: { id: string; user: User }) {
  const { data: items, error, act } = useData<Asg[]>(`/batches/${id}/assignments`);
  const manage = can(user, "content.manage");
  const student = user.role === "STUDENT";
  const [f, setF] = useState({ title: "", description: "", dueAt: "", maxMarks: "100" });
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [del, setDel] = useState<Asg | null>(null);
  const [grading, setGrading] = useState<Asg | null>(null);
  return (
    <div className="space-y-4">
      <ErrorMsg error={error} />
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState icon="clipboard" title="কোনো অ্যাসাইনমেন্ট নেই" hint="শিক্ষক হোমওয়ার্ক দিলে এখানে দেখা যাবে।" />}
      {items?.map((a) => {
        const late = a.dueAt && new Date(a.dueAt).getTime() < Date.now();
        const mine = a.submissions?.[0];
        return (
          <Card key={a.id} className="space-y-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-base font-bold">{a.title}</p>
                <p className="text-xs text-sub">
                  পূর্ণমান {bn(a.maxMarks)} · {a.dueAt ? <>জমার শেষ সময়: {fmtDate(a.dueAt)} {late && <Badge tone="red">সময় শেষ</Badge>}</> : "শেষ সময় নেই"}
                </p>
              </div>
              {manage && (
                <div className="flex gap-2">
                  <button className={btnGhost} onClick={() => setGrading(a)}>
                    জমা ({bn(a._count.submissions)})
                  </button>
                  <button className={btnDanger} aria-label="মুছুন" onClick={() => setDel(a)}>
                    <Icon name="trash" className="size-4" />
                  </button>
                </div>
              )}
            </div>
            {a.description && <p className="whitespace-pre-wrap text-sub">{a.description}</p>}
            {a.fileUrl && (
              <a href={fileUrl(a.fileUrl)} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                <Icon name="file" className="size-4" /> সংযুক্ত ফাইল
              </a>
            )}
            {student && <SubmitBox a={a} mine={mine} late={!!late} onDone={() => act(async () => undefined)} />}
          </Card>
        );
      })}
      {manage && (
        <Card className="max-w-xl">
          <h3 className="mb-3 font-bold">নতুন অ্যাসাইনমেন্ট</h3>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              act(async () => {
                try {
                  const fileUrl = file ? await uploadFile(file) : undefined;
                  await api(`/batches/${id}/assignments`, { body: { ...f, dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : undefined, fileUrl } });
                  setF({ title: "", description: "", dueAt: "", maxMarks: "100" });
                  setFile(null);
                } catch (err) {
                  setFormError(err instanceof Error ? err.message : "ব্যর্থ");
                }
              });
            }}
          >
            <Field label="শিরোনাম">{(i) => <input id={i} className={inputCls} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
            <Field label="নির্দেশনা">{(i) => <textarea id={i} className={inputCls} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="জমার শেষ সময় (ঐচ্ছিক)">{(i) => <input id={i} className={inputCls} type="datetime-local" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} />}</Field>
              <Field label="পূর্ণমান">{(i) => <input id={i} className={inputCls} type="number" min={1} max={1000} value={f.maxMarks} onChange={(e) => setF({ ...f, maxMarks: e.target.value })} />}</Field>
            </div>
            <Field label="প্রশ্নপত্র (PDF, ঐচ্ছিক)">{(i) => <input id={i} className={inputCls} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
            <ErrorMsg error={formError} />
            <button className={btnCls}>অ্যাসাইনমেন্ট দিন</button>
          </form>
        </Card>
      )}
      <GradeModal asg={grading} canGrade={manage} onClose={() => { setGrading(null); act(async () => undefined); }} />
      <ConfirmModal open={!!del} title="অ্যাসাইনমেন্ট মুছবেন?" message={`“${del?.title}” ও সব জমা মুছে যাবে।`} confirmLabel="মুছুন" onConfirm={() => del && act(() => api(`/assignments/${del.id}`, { method: "DELETE" }))} onClose={() => setDel(null)} />
    </div>
  );
}

function SubmitBox({ a, mine, late, onDone }: { a: Asg; mine?: Sub; late: boolean; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const graded = !!mine?.gradedAt;
  return (
    <div className="rounded-lg bg-canvas p-3">
      {mine && (
        <div className="mb-2 space-y-1">
          <p className="font-semibold">
            জমা দিয়েছেন <span className="text-xs font-normal text-faint">({fmtDate(mine.submittedAt)})</span>{" "}
            {graded ? <Badge tone="green">নম্বর: {bn(mine.marks ?? 0)}/{bn(a.maxMarks)}</Badge> : <Badge tone="amber">যাচাই বাকি</Badge>}
          </p>
          {mine.note && <p className="whitespace-pre-wrap text-sub">{mine.note}</p>}
          {mine.fileUrl && (
            <a href={fileUrl(mine.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-brand underline">
              আপনার ফাইল
            </a>
          )}
          {mine.feedback && <p className="text-sm">শিক্ষকের মন্তব্য: <b>{mine.feedback}</b></p>}
        </div>
      )}
      {!graded && !open && (
        <button className={btnCls} onClick={() => setOpen(true)}>
          {mine ? "আবার জমা দিন" : late ? "দেরিতে জমা দিন" : "জমা দিন"}
        </button>
      )}
      {!graded && open && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              const url = file ? await uploadSubmission(file) : undefined;
              await api(`/assignments/${a.id}/submit`, { body: { note, fileUrl: url } });
              setOpen(false);
              setNote("");
              setFile(null);
              onDone();
            } catch (x) {
              setErr(x instanceof Error ? x.message : "ব্যর্থ");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className={inputCls} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <textarea className={inputCls} rows={3} placeholder="লিখিত উত্তর বা মন্তব্য (ঐচ্ছিক)" value={note} onChange={(e) => setNote(e.target.value)} />
          <ErrorMsg error={err} />
          <div className="flex gap-2">
            <button className={btnCls} disabled={busy}>{busy ? "জমা হচ্ছে..." : "জমা দিন"}</button>
            <button type="button" className={btnGhost} onClick={() => setOpen(false)}>বাতিল</button>
          </div>
        </form>
      )}
    </div>
  );
}

type SubRow = { userId: string; name: string; phone: string | null; submission: Sub | null };
function GradeModal({ asg, canGrade, onClose }: { asg: Asg | null; canGrade: boolean; onClose: () => void }) {
  const { data, error, act } = useData<{ assignment: Asg; rows: SubRow[] }>(asg ? `/assignments/${asg.id}/submissions` : "/auth/me");
  const [vals, setVals] = useState<Record<string, { marks: string; feedback: string }>>({});
  if (!asg) return null;
  const rows = data && "rows" in data ? data.rows : null;
  return (
    <Modal open title={`জমা: ${asg.title}`} onClose={onClose} wide>
      <ErrorMsg error={error} />
      {!rows && !error && <Loading />}
      {rows && (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
          <p className="text-sub">জমা দিয়েছে {bn(rows.filter((r) => r.submission).length)} / {bn(rows.length)} জন</p>
          {rows.map((r) => {
            const s = r.submission;
            const v = vals[r.userId] ?? { marks: s?.marks?.toString() ?? "", feedback: s?.feedback ?? "" };
            return (
              <div key={r.userId} className="rounded-lg border border-line p-3">
                <p className="font-semibold">
                  {r.name} {!s && <Badge tone="red">জমা দেয়নি</Badge>} {s?.gradedAt && <Badge tone="green">নম্বর দেওয়া হয়েছে</Badge>}
                </p>
                {s && (
                  <>
                    <p className="text-xs text-faint">{fmtDate(s.submittedAt)} {asg.dueAt && new Date(s.submittedAt) > new Date(asg.dueAt) && <Badge tone="amber">দেরিতে</Badge>}</p>
                    {s.note && <p className="mt-1 whitespace-pre-wrap text-sub">{s.note}</p>}
                    {s.fileUrl && (
                      <a href={fileUrl(s.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                        ফাইল খুলুন
                      </a>
                    )}
                    {canGrade && (
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <input className={`${inputCls} w-24`} type="number" min={0} max={asg.maxMarks} placeholder={`/${asg.maxMarks}`} value={v.marks} onChange={(e) => setVals({ ...vals, [r.userId]: { ...v, marks: e.target.value } })} />
                        <input className={`${inputCls} min-w-40 flex-1`} placeholder="মন্তব্য" value={v.feedback} onChange={(e) => setVals({ ...vals, [r.userId]: { ...v, feedback: e.target.value } })} />
                        <button className={btnCls} onClick={() => act(() => api(`/submissions/${s.id}/grade`, { method: "PATCH", body: { marks: Number(v.marks), feedback: v.feedback } }))}>
                          সংরক্ষণ
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// =============================================================== Doubts
type Doubt = {
  id: string;
  title: string;
  body: string;
  ref: string | null;
  resolved: boolean;
  createdAt: string;
  user: { id: string; name: string; role: string };
  replies: { id: string; body: string; createdAt: string; user: { id: string; name: string; role: string } }[];
};
const roleTag = (r: string) => (r === "ADMIN" ? <Badge tone="brand">অ্যাডমিন</Badge> : r === "TEACHER" ? <Badge tone="brand">শিক্ষক</Badge> : null);

export function DoubtsTab({ id, user, initialRef }: { id: string; user: User; initialRef?: string }) {
  const { data: items, error, act } = useData<Doubt[]>(`/batches/${id}/doubts`);
  const [f, setF] = useState({ title: initialRef ? `প্রশ্ন: ${initialRef}` : "", body: "", ref: initialRef ?? "" });
  const [reply, setReply] = useState<Record<string, string>>({});
  const [del, setDel] = useState<Doubt | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const staff = user.role !== "STUDENT";
  return (
    <div className="space-y-4">
      <ErrorMsg error={error} />
      <Card className="max-w-2xl">
        <h3 className="mb-3 font-bold">নতুন প্রশ্ন করুন</h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            act(async () => {
              try {
                await api(`/batches/${id}/doubts`, { body: f });
                setF({ title: "", body: "", ref: "" });
              } catch (x) {
                setFormError(x instanceof Error ? x.message : "ব্যর্থ");
              }
            });
          }}
        >
          <input className={inputCls} required placeholder="প্রশ্নের শিরোনাম" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <textarea className={inputCls} required rows={3} placeholder="কোথায় আটকে গেছেন, বিস্তারিত লিখুন" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <input className={inputCls} placeholder="কোন ক্লাস/ভিডিও সম্পর্কে? (ঐচ্ছিক)" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} />
          <ErrorMsg error={formError} />
          <button className={btnCls}>প্রশ্ন জমা দিন</button>
        </form>
      </Card>
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState icon="chat" title="এখনো কোনো প্রশ্ন নেই" hint="প্রথম প্রশ্নটি আপনিই করুন।" />}
      {items?.map((d) => (
        <Card key={d.id} className="space-y-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-base font-bold">
                {d.title} {d.resolved && <Badge tone="green">সমাধান হয়েছে</Badge>}
              </p>
              <p className="text-xs text-sub">
                {d.user.name} {roleTag(d.user.role)} · {fmtDay(d.createdAt)} {d.ref && <>· <span className="text-brand">{d.ref}</span></>}
              </p>
            </div>
            <div className="flex gap-2">
              {(staff || d.user.id === user.id) && (
                <>
                  <button className={btnGhost} onClick={() => act(() => api(`/doubts/${d.id}/resolve`, { method: "PATCH", body: { resolved: !d.resolved } }))}>
                    {d.resolved ? "আবার খুলুন" : "সমাধান হয়েছে"}
                  </button>
                  <button className={btnDanger} aria-label="মুছুন" onClick={() => setDel(d)}>
                    <Icon name="trash" className="size-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="whitespace-pre-wrap">{d.body}</p>
          {d.replies.length > 0 && (
            <div className="space-y-2 border-l-2 border-line pl-3">
              {d.replies.map((r) => (
                <div key={r.id}>
                  <p className="text-xs text-sub">
                    <b className="text-ink">{r.user.name}</b> {roleTag(r.user.role)} · {fmtDate(r.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap">{r.body}</p>
                </div>
              ))}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const body = reply[d.id]?.trim();
              if (!body) return;
              act(async () => {
                await api(`/doubts/${d.id}/replies`, { body: { body } });
                setReply({ ...reply, [d.id]: "" });
              });
            }}
          >
            <input className={inputCls} placeholder="উত্তর লিখুন…" value={reply[d.id] ?? ""} onChange={(e) => setReply({ ...reply, [d.id]: e.target.value })} />
            <button className={btnCls}>পাঠান</button>
          </form>
        </Card>
      ))}
      <ConfirmModal open={!!del} title="প্রশ্ন মুছবেন?" message="প্রশ্ন ও সব উত্তর মুছে যাবে।" confirmLabel="মুছুন" onConfirm={() => del && act(() => api(`/doubts/${del.id}`, { method: "DELETE" }))} onClose={() => setDel(null)} />
    </div>
  );
}

// =============================================================== Progress + leaderboard
type Progress = {
  percent: number;
  materials: { done: number; total: number };
  exams: { done: number; total: number };
  assignments: { done: number; total: number };
  classes: { attended: number; total: number };
  examPct: number | null;
  certMin: number;
  certificate: string | null;
};
type LB = { rank: number; userId: string; name: string; photoUrl: string | null; examPct: number | null; exams: number; progress: number; classes: number };

export function ProgressTab({ id, user }: { id: string; user: User }) {
  const student = user.role === "STUDENT";
  const { data: p, error: pe } = useData<Progress>(student ? `/batches/${id}/progress` : "/auth/me");
  const { data: lb, error: le } = useData<{ total: number; me: LB | null; rows: LB[]; classesTotal: number }>(`/batches/${id}/leaderboard`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const prog = student ? p : null;
  const eligible = !!prog && prog.percent >= prog.certMin;
  return (
    <div className="space-y-5">
      <ErrorMsg error={pe ?? le ?? err} />
      {student && !prog && !pe && <Loading />}
      {prog && (
        <Card className="space-y-4">
          <div>
            <div className="mb-1 flex items-end justify-between">
              <h3 className="font-bold">আমার অগ্রগতি</h3>
              <span className="text-2xl font-bold text-brand">{bn(prog.percent)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuenow={prog.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${prog.percent}%` }} />
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <Mini k="নোট/ভিডিও সম্পন্ন" v={`${bn(prog.materials.done)}/${bn(prog.materials.total)}`} />
            <Mini k="পরীক্ষা দেওয়া" v={`${bn(prog.exams.done)}/${bn(prog.exams.total)}`} />
            <Mini k="অ্যাসাইনমেন্ট জমা" v={`${bn(prog.assignments.done)}/${bn(prog.assignments.total)}`} />
            <Mini k="ক্লাসে হাজিরা" v={`${bn(prog.classes.attended)}/${bn(prog.classes.total)}`} />
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-canvas p-3 text-sm">
            <Icon name="shield" className="size-5 text-brand" />
            {prog.certificate ? (
              <>
                <span className="font-semibold">আপনার সার্টিফিকেট প্রস্তুত</span>
                <Link href={`/certificate/${prog.certificate}`} className={btnCls}>সার্টিফিকেট দেখুন</Link>
              </>
            ) : eligible ? (
              <>
                <span className="font-semibold">অভিনন্দন! সার্টিফিকেট নেওয়ার যোগ্য হয়েছেন।</span>
                <button
                  className={btnCls}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr(null);
                    try {
                      const r = await api<{ code: string }>(`/batches/${id}/certificate`, { method: "POST", body: {} });
                      window.location.href = `/certificate/${r.code}`;
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "ব্যর্থ");
                      setBusy(false);
                    }
                  }}
                >
                  সার্টিফিকেট নিন
                </button>
              </>
            ) : (
              <span className="text-sub">সার্টিফিকেটের জন্য কমপক্ষে {bn(prog.certMin)}% সম্পন্ন করুন (এখন {bn(prog.percent)}%)।</span>
            )}
          </div>
        </Card>
      )}
      <div>
        <h3 className="mb-2 font-bold">লিডারবোর্ড <span className="text-sm font-normal text-sub">(পরীক্ষার গড় নম্বর অনুযায়ী)</span></h3>
        {!lb && !le && <Loading />}
        {lb?.rows.length === 0 && <EmptyState icon="users" title="এখনো কেউ নেই" />}
        <div className="space-y-2">
          {lb?.rows.map((r) => (
            <LbRow key={r.userId} r={r} me={r.userId === lb.me?.userId} />
          ))}
          {student && lb?.me && !lb.rows.some((r) => r.userId === lb.me!.userId) && (
            <>
              <p className="text-center text-faint">⋮</p>
              <LbRow r={lb.me} me />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const Mini = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-lg border border-line p-3">
    <p className="text-xs text-sub">{k}</p>
    <p className="text-lg font-bold">{v}</p>
  </div>
);

function LbRow({ r, me }: { r: LB; me: boolean }) {
  return (
    <Card className={`flex items-center gap-3 !py-2.5 text-sm ${me ? "!border-brand bg-brand-soft/40" : ""}`}>
      <span className={`grid size-8 shrink-0 place-items-center rounded-full font-bold ${r.rank <= 3 ? "bg-warn-soft text-warn" : "bg-canvas text-sub"}`}>{bn(r.rank)}</span>
      <Avatar name={r.name} src={r.photoUrl} />
      <p className="min-w-0 flex-1 truncate font-semibold">
        {r.name} {me && <Badge tone="brand">আপনি</Badge>}
      </p>
      <div className="flex shrink-0 gap-4 text-right text-xs text-sub">
        <span>
          <b className="block text-base text-ink">{r.examPct === null ? "—" : `${bn(r.examPct)}%`}</b>পরীক্ষা ({bn(r.exams)})
        </span>
        <span className="hidden sm:block">
          <b className="block text-base text-ink">{bn(r.progress)}%</b>অগ্রগতি
        </span>
      </div>
    </Card>
  );
}

// =============================================================== Renewal (monthly courses)
const METHODS = ["bKash", "Nagad", "Rocket", "Bank"] as const;
const SETTING: Record<(typeof METHODS)[number], keyof SiteInfo["settings"]> = { bKash: "bkash", Nagad: "nagad", Rocket: "rocket", Bank: "bank" };

export function RenewCard({ batchId, fee, expired, daysLeft: left, onDone }: { batchId: string; fee: number; expired: boolean; daysLeft: number; onDone: () => void }) {
  const { data: site } = usePublic<SiteInfo>("/public/site");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("bKash");
  const [trxId, setTrxId] = useState("");
  const [coupon, setCoupon] = useState("");
  const [price, setPrice] = useState<{ amount: number; discount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const number = site?.settings[SETTING[method]] ?? "";
  const amount = price ? price.amount : fee;
  async function check() {
    setErr(null);
    try {
      setPrice(await api(`/coupons/validate`, { body: { batchId, code: coupon } }));
    } catch (e) {
      setPrice(null);
      setErr(e instanceof Error ? e.message : "ব্যর্থ");
    }
  }
  if (sent) {
    return (
      <Card className="mb-5 border-ok/30 bg-ok-soft text-sm">
        <p className="font-bold text-ok">নবায়নের পেমেন্ট জমা হয়েছে</p>
        <p className="text-sub">যাচাই শেষ হলেই আরও ৩০ দিনের জন্য কোর্স চালু হবে।</p>
      </Card>
    );
  }
  return (
    <Card className={`mb-5 space-y-4 text-sm ${expired ? "border-danger/30" : "border-warn/40"}`}>
      <div>
        <p className={`text-base font-bold ${expired ? "text-danger" : "text-warn"}`}>{expired ? "কোর্সের মেয়াদ শেষ হয়েছে" : `মেয়াদ আর ${bn(left)} দিন বাকি`}</p>
        <p className="text-sub">মাসিক ফি {taka(fee)}। নবায়ন করলে আরও ৩০ দিন পাবেন।</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {METHODS.map((m) => (
          <button key={m} onClick={() => setMethod(m)} className={`rounded-lg border-2 px-3 py-1.5 font-semibold ${method === m ? "border-brand bg-brand-soft text-brand-dark" : "border-line"}`}>
            {m === "Bank" ? "ব্যাংক" : m}
          </button>
        ))}
      </div>
      <p className="rounded-lg bg-canvas p-3">
        {number ? <><b className="font-mono text-base">{number}</b> — এই নম্বরে ঠিক <b>{taka(amount)}</b> পাঠান, তারপর Transaction ID লিখুন।</> : "এই মেথডের নম্বর এখনো দেওয়া হয়নি।"}
      </p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await api(`/batches/${batchId}/renew`, { body: { method, trxId, coupon } });
            setSent(true);
            onDone();
          } catch (x) {
            setErr(x instanceof Error ? x.message : "ব্যর্থ");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex gap-2">
          <input className={inputCls} placeholder="কুপন কোড (থাকলে)" value={coupon} onChange={(e) => { setCoupon(e.target.value); setPrice(null); }} />
          <button type="button" className={btnGhost} onClick={check} disabled={!coupon.trim()}>প্রয়োগ</button>
        </div>
        {price && price.discount > 0 && <p className="text-ok">ছাড় {taka(price.discount)} — দিতে হবে {taka(price.amount)}</p>}
        <input className={`${inputCls} font-mono`} placeholder={amount === 0 ? "ফ্রি — Transaction ID লাগবে না" : "Transaction ID"} required={amount > 0} disabled={amount === 0} value={trxId} onChange={(e) => setTrxId(e.target.value)} autoComplete="off" />
        <ErrorMsg error={err} />
        <button className={btnCls} disabled={busy}>{busy ? "জমা হচ্ছে..." : "নবায়ন করুন"}</button>
      </form>
    </Card>
  );
}
