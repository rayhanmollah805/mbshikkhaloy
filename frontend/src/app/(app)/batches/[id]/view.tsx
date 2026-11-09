"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmModal } from "@/components/confirm";
import { CourseCover } from "@/components/course-card";
import { Icon } from "@/components/icons";
import {
  Badge,
  Card,
  DAYS,
  EmptyState,
  ErrorMsg,
  Field,
  Skeleton,
  Tabs,
  bn,
  btnCls,
  btnDanger,
  btnGhost,
  fmtDate,
  inputCls,
} from "@/components/ui";
import { api, fileUrl, uploadFile } from "@/lib/api";
import { can, useRequireUser, type User } from "@/lib/auth";

type Tab = "live" | "routine" | "notices" | "materials" | "exams" | "students";

/** Loads a list and gives a wrapper that reloads after writes and reports errors. */
function useList<T>(path: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<T[]>(path).then(setItems).catch((e) => setError(e.message)), [path]);
  useEffect(() => {
    // Initial data fetch on mount.
     
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
  return { items, error, act };
}

const Loading = () => <Skeleton className="h-24" />;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-5 max-w-xl">
      <h3 className="mb-4 flex items-center gap-2 font-bold">
        <Icon name="plus" className="size-4 text-brand" /> {title}
      </h3>
      {children}
    </Card>
  );
}

export default function BatchPage() {
  const user = useRequireUser();
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<{ id: string; title: string; description: string | null } | null>(null);
  const [tab, setTab] = useState<Tab>("live");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api(`/batches/${id}`)
      .then(setBatch)
      .catch((e) => setError(e.message));
  }, [user, id]);

  if (!user) return null;
  const staff = user.role !== "STUDENT";

  const tabs: { key: Tab; label: string; icon: "radio" | "calendar" | "bell" | "file" | "clipboard" | "users" }[] = [
    { key: "live", label: "লাইভ ক্লাস", icon: "radio" },
    { key: "routine", label: "ক্লাস রুটিন", icon: "calendar" },
    { key: "notices", label: "নোটিশ", icon: "bell" },
    { key: "materials", label: "নোট ও ভিডিও", icon: "file" },
    { key: "exams", label: "পরীক্ষা", icon: "clipboard" },
    ...(can(user, "student.view") ? [{ key: "students" as Tab, label: "শিক্ষার্থী", icon: "users" as const }] : []),
  ];

  return (
    <div className="fade-in">
      <Link href={staff ? (user.role === "ADMIN" ? "/admin/courses" : "/courses") : "/courses"} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        ← কোর্সসমূহ
      </Link>
      {batch && (
        <div className="mb-6 overflow-hidden rounded-xl border border-line bg-surface">
          <CourseCover course={batch} />
          {batch.description && <p className="p-4 text-sm text-sub">{batch.description}</p>}
        </div>
      )}
      <ErrorMsg error={error} />
      {!batch && !error && <Skeleton className="h-36" />}
      {batch && (
        <>
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          {tab === "live" && <LiveTab id={id} user={user} />}
          {tab === "routine" && <RoutineTab id={id} user={user} />}
          {tab === "notices" && <NoticesTab id={id} user={user} />}
          {tab === "materials" && <MaterialsTab id={id} user={user} />}
          {tab === "exams" && <ExamsTab id={id} user={user} />}
          {tab === "students" && <StudentsTab id={id} />}
        </>
      )}
    </div>
  );
}

// ---------------- Live ----------------
type Live = { id: string; title: string; url: string; startsAt: string; isLive: boolean };
function LiveTab({ id, user }: { id: string; user: User }) {
  const { items, error, act } = useList<Live>(`/batches/${id}/live`);
  const manage = can(user, "live.manage");
  const [f, setF] = useState({ title: "", url: "", startsAt: "" });
  const [del, setDel] = useState<Live | null>(null);
  return (
    <div className="space-y-3">
      <ErrorMsg error={error} />
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState icon="radio" title="কোনো ক্লাস নেই" hint="লাইভ ক্লাস যোগ হলে এখানে দেখা যাবে।" />}
      {items?.map((c) => (
        <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">
              {c.title} {c.isLive && <Badge tone="red">● LIVE</Badge>}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-sub">
              <Icon name="clock" className="size-4" /> {fmtDate(c.startsAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {c.isLive ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Live Class এ যোগ দিন
              </a>
            ) : (
              <span className="rounded-lg bg-canvas px-4 py-2 text-sm text-faint">এখনো শুরু হয়নি</span>
            )}
            {manage && (
              <>
                <button className={btnGhost} onClick={() => act(() => api(`/live/${c.id}`, { method: "PATCH", body: { isLive: !c.isLive } }))}>
                  {c.isLive ? "লাইভ বন্ধ" : "লাইভ শুরু"}
                </button>
                <button className={btnDanger} aria-label="মুছুন" onClick={() => setDel(c)}>
                  <Icon name="trash" className="size-4" />
                </button>
              </>
            )}
          </div>
        </Card>
      ))}
      {manage && (
        <Section title="নতুন লাইভ ক্লাস">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await api(`/batches/${id}/live`, { body: { ...f, startsAt: new Date(f.startsAt).toISOString() } });
                setF({ title: "", url: "", startsAt: "" });
              });
            }}
          >
            <Field label="ক্লাসের নাম">{(i) => <input id={i} className={inputCls} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
            <Field label="Meet / Zoom লিংক">{(i) => <input id={i} className={inputCls} type="url" placeholder="https://..." required value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />}</Field>
            <Field label="শুরুর সময়">{(i) => <input id={i} className={inputCls} type="datetime-local" required value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />}</Field>
            <button className={btnCls}>যোগ করুন</button>
          </form>
        </Section>
      )}
      <ConfirmModal open={!!del} title="ক্লাস মুছবেন?" message={`“${del?.title}” মুছে ফেলা হবে।`} confirmLabel="মুছুন" onConfirm={() => del && act(() => api(`/live/${del.id}`, { method: "DELETE" }))} onClose={() => setDel(null)} />
    </div>
  );
}

// ---------------- Routine ----------------
type Routine = { id: string; dayOfWeek: number; startTime: string; endTime: string; subject: string };
function RoutineTab({ id, user }: { id: string; user: User }) {
  const { items, error, act } = useList<Routine>(`/batches/${id}/routines`);
  const manage = can(user, "routine.manage");
  const [f, setF] = useState({ dayOfWeek: "0", startTime: "10:00", endTime: "11:00", subject: "" });
  return (
    <div>
      <ErrorMsg error={error} />
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState icon="calendar" title="রুটিন দেওয়া হয়নি" />}
      <div className="grid gap-3 sm:grid-cols-2">
        {items?.map((r) => (
          <Card key={r.id} className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-lg bg-brand-soft text-center text-sm font-bold leading-tight text-brand-dark">{DAYS[r.dayOfWeek]}</span>
              <div>
                <p className="font-bold">{r.subject}</p>
                <p className="text-sm text-sub">
                  {r.startTime} – {r.endTime}
                </p>
              </div>
            </div>
            {manage && (
              <button className={btnDanger} aria-label="মুছুন" onClick={() => act(() => api(`/routines/${r.id}`, { method: "DELETE" }))}>
                <Icon name="trash" className="size-4" />
              </button>
            )}
          </Card>
        ))}
      </div>
      {manage && (
        <Section title="রুটিন যোগ করুন">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await api(`/batches/${id}/routines`, { body: { ...f, dayOfWeek: Number(f.dayOfWeek) } });
                setF({ ...f, subject: "" });
              });
            }}
          >
            <Field label="বার">
              {(i) => (
                <select id={i} className={inputCls} value={f.dayOfWeek} onChange={(e) => setF({ ...f, dayOfWeek: e.target.value })}>
                  {DAYS.map((d, k) => (
                    <option key={d} value={k}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="শুরু">{(i) => <input id={i} className={inputCls} type="time" required value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />}</Field>
              <Field label="শেষ">{(i) => <input id={i} className={inputCls} type="time" required value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />}</Field>
            </div>
            <Field label="বিষয়">{(i) => <input id={i} className={inputCls} required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />}</Field>
            <button className={btnCls}>যোগ করুন</button>
          </form>
        </Section>
      )}
    </div>
  );
}

// ---------------- Notices ----------------
type Notice = { id: string; title: string; body: string; createdAt: string; batchId: string | null; batch: { title: string } | null };
function NoticesTab({ id, user }: { id: string; user: User }) {
  const { items: all, error, act } = useList<Notice>(`/notices`);
  const manage = can(user, "notice.manage");
  const [f, setF] = useState({ title: "", body: "" });
  const items = all?.filter((n) => !n.batchId || n.batchId === id) ?? null;
  return (
    <div className="space-y-3">
      <ErrorMsg error={error} />
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState icon="bell" title="কোনো নোটিশ নেই" />}
      {items?.map((n) => (
        <Card key={n.id} className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">{n.title}</p>
            <p className="whitespace-pre-wrap text-sm text-sub">{n.body}</p>
            <p className="mt-1 text-xs text-faint">
              {n.batch?.title ?? "সবার জন্য"} · {fmtDate(n.createdAt)}
            </p>
          </div>
          {manage && n.batchId && (
            <button className={btnDanger} aria-label="মুছুন" onClick={() => act(() => api(`/notices/${n.id}`, { method: "DELETE" }))}>
              <Icon name="trash" className="size-4" />
            </button>
          )}
        </Card>
      ))}
      {manage && (
        <Section title="এই কোর্সের নোটিশ">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await api(`/notices`, { body: { ...f, batchId: id } });
                setF({ title: "", body: "" });
              });
            }}
          >
            <Field label="শিরোনাম">{(i) => <input id={i} className={inputCls} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
            <Field label="বিবরণ">{(i) => <textarea id={i} rows={3} className={inputCls} required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
            <button className={btnCls}>নোটিশ দিন</button>
          </form>
        </Section>
      )}
    </div>
  );
}

// ---------------- Materials (PDF notes / videos) ----------------
type Material = { id: string; type: "PDF" | "VIDEO"; title: string; url: string };
const VIDEO_FILE = /\.(mp4|webm|mov)$/i;
function ytEmbed(url: string) {
  try {
    const u = new URL(url);
    const v = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : u.searchParams.get("v");
    if ((u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) && v) {
      return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
    }
  } catch {}
  return null;
}

function MaterialsTab({ id, user }: { id: string; user: User }) {
  const { items, error, act } = useList<Material>(`/batches/${id}/materials`);
  const manage = can(user, "content.manage");
  const [f, setF] = useState({ type: "VIDEO", title: "", url: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [del, setDel] = useState<Material | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <div>
      <ErrorMsg error={error} />
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState icon="file" title="কোনো নোট বা ভিডিও নেই" hint="আপলোড হলে এখানে দেখা যাবে।" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {items?.map((m) => {
          const embed = m.type === "VIDEO" ? ytEmbed(m.url) : null;
          const isFile = m.type === "VIDEO" && VIDEO_FILE.test(m.url);
          return (
            <Card key={m.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">
                  <Badge tone={m.type === "PDF" ? "brand" : "red"}>{m.type === "PDF" ? "PDF" : "ভিডিও"}</Badge> <span className="ml-1">{m.title}</span>
                </p>
                {manage && (
                  <button className={btnDanger} aria-label="মুছুন" onClick={() => setDel(m)}>
                    <Icon name="trash" className="size-4" />
                  </button>
                )}
              </div>
              {embed ? (
                <iframe src={embed} className="aspect-video w-full rounded-lg bg-ink" allowFullScreen title={m.title} />
              ) : isFile ? (
                <video src={fileUrl(m.url)} controls preload="metadata" className="aspect-video w-full rounded-lg bg-ink" />
              ) : (
                <a href={fileUrl(m.url)} target="_blank" rel="noopener noreferrer" className={btnCls}>
                  <Icon name={m.type === "PDF" ? "file" : "play"} className="size-4" /> {m.type === "PDF" ? "PDF খুলুন" : "ভিডিও দেখুন"}
                </a>
              )}
            </Card>
          );
        })}
      </div>
      {manage && (
        <Section title="নোট / ভিডিও যোগ করুন">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              act(async () => {
                setUploading(true);
                try {
                  let url = f.url;
                  if (file) url = await uploadFile(file);
                  await api(`/batches/${id}/materials`, { body: { ...f, url } });
                  setF({ type: f.type, title: "", url: "" });
                  setFile(null);
                } catch (err) {
                  setFormError(err instanceof Error ? err.message : "ব্যর্থ");
                } finally {
                  setUploading(false);
                }
              });
            }}
          >
            <Field label="ধরন">
              {(i) => (
                <select id={i} className={inputCls} value={f.type} onChange={(e) => { setF({ ...f, type: e.target.value }); setFile(null); }}>
                  <option value="VIDEO">ভিডিও ক্লাস</option>
                  <option value="PDF">PDF নোট</option>
                </select>
              )}
            </Field>
            <Field label="শিরোনাম">{(i) => <input id={i} className={inputCls} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
            <Field label={f.type === "VIDEO" ? "ভিডিও ফাইল আপলোড (MP4/WebM/MOV, সর্বোচ্চ ৫০০MB)" : "PDF ফাইল আপলোড"}>
              {(i) => <input id={i} className={inputCls} type="file" accept={f.type === "VIDEO" ? "video/mp4,video/webm,video/quicktime" : "application/pdf"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
            </Field>
            {!file && (
              <Field label={f.type === "VIDEO" ? "অথবা YouTube / ভিডিও লিংক" : "অথবা PDF লিংক"}>
                {(i) => <input id={i} className={inputCls} type="url" placeholder="https://..." required value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />}
              </Field>
            )}
            <ErrorMsg error={formError} />
            <button className={btnCls} disabled={uploading}>
              <Icon name="upload" className="size-4" /> {uploading ? "আপলোড হচ্ছে..." : "যোগ করুন"}
            </button>
          </form>
        </Section>
      )}
      <ConfirmModal open={!!del} title="মুছবেন?" message={`“${del?.title}” মুছে ফেলা হবে।`} confirmLabel="মুছুন" onConfirm={() => del && act(() => api(`/materials/${del.id}`, { method: "DELETE" }))} onClose={() => setDel(null)} />
    </div>
  );
}

// ---------------- Exams ----------------
type Exam = {
  id: string;
  title: string;
  durationMin: number;
  published: boolean;
  _count: { questions: number; attempts: number };
  myAttempt: { score: number; total: number } | null;
};
type QDraft = { text: string; options: string[]; correctIndex: number };
const blankQ = (): QDraft => ({ text: "", options: ["", "", "", ""], correctIndex: 0 });
type AttemptRow = { id: string; score: number; total: number; user: { name: string; email: string } };

function ExamsTab({ id, user }: { id: string; user: User }) {
  const { items, error, act } = useList<Exam>(`/batches/${id}/exams`);
  const manage = can(user, "exam.manage");
  const viewResults = can(user, "student.view");
  const staff = user.role !== "STUDENT";
  const [title, setTitle] = useState("");
  const [dur, setDur] = useState("20");
  const [qs, setQs] = useState<QDraft[]>([blankQ()]);
  const [results, setResults] = useState<{ title: string; rows: AttemptRow[] } | null>(null);
  const [del, setDel] = useState<Exam | null>(null);
  const setQ = (i: number, p: Partial<QDraft>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...p } : q)));

  return (
    <div className="space-y-3">
      <ErrorMsg error={error} />
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState icon="clipboard" title="কোনো পরীক্ষা নেই" />}
      {items?.map((x) => (
        <Card key={x.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">
              {x.title} {staff && !x.published && <Badge tone="amber">খসড়া</Badge>}
            </p>
            <p className="text-sm text-sub">
              {bn(x._count.questions)}টি MCQ · {bn(x.durationMin)} মিনিট{staff && viewResults && ` · ${bn(x._count.attempts)}টি জমা`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!staff &&
              (x.myAttempt ? (
                <>
                  <Badge tone="green">
                    স্কোর {bn(x.myAttempt.score)}/{bn(x.myAttempt.total)}
                  </Badge>
                  <Link href={`/exams/${x.id}/result`} className={btnGhost}>
                    ফলাফল দেখুন
                  </Link>
                </>
              ) : (
                <Link href={`/exams/${x.id}`} className={btnCls}>
                  পরীক্ষা দিন
                </Link>
              ))}
            {manage && (
              <button className={btnGhost} onClick={() => act(() => api(`/exams/${x.id}/publish`, { method: "PATCH", body: { published: !x.published } }))}>
                {x.published ? "আনপাবলিশ" : "পাবলিশ"}
              </button>
            )}
            {staff && viewResults && (
              <button
                className={btnGhost}
                onClick={async () => {
                  try {
                    setResults({ title: x.title, rows: await api(`/exams/${x.id}/attempts`) });
                  } catch {}
                }}
              >
                ফলাফল
              </button>
            )}
            {manage && (
              <button className={btnDanger} aria-label="মুছুন" onClick={() => setDel(x)}>
                <Icon name="trash" className="size-4" />
              </button>
            )}
          </div>
        </Card>
      ))}

      {results && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">ফলাফল — {results.title}</h3>
            <button className={btnGhost} onClick={() => setResults(null)}>
              বন্ধ
            </button>
          </div>
          {results.rows.length === 0 && <p className="text-sm text-faint">এখনো কেউ জমা দেয়নি।</p>}
          {results.rows.map((r, i) => (
            <p key={r.id} className="flex items-center justify-between border-t border-line py-2 text-sm">
              <span>
                <span className="mr-2 text-faint">{bn(i + 1)}.</span>
                {r.user.name} <span className="text-faint">({r.user.email})</span>
              </span>
              <b>
                {bn(r.score)}/{bn(r.total)}
              </b>
            </p>
          ))}
        </Card>
      )}

      {manage && (
        <Card className="mt-5">
          <h3 className="mb-4 flex items-center gap-2 font-bold">
            <Icon name="plus" className="size-4 text-brand" /> নতুন পরীক্ষা (MCQ)
          </h3>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await api(`/batches/${id}/exams`, { body: { title, durationMin: Number(dur), questions: qs } });
                setTitle("");
                setQs([blankQ()]);
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
              <Field label="পরীক্ষার নাম">{(i) => <input id={i} className={inputCls} required value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
              <Field label="সময় (মিনিট)">{(i) => <input id={i} className={inputCls} type="number" min={1} required value={dur} onChange={(e) => setDur(e.target.value)} />}</Field>
            </div>
            {qs.map((q, i) => (
              <fieldset key={i} className="space-y-2 rounded-xl border border-line bg-canvas/60 p-4">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-bold text-brand-dark">প্রশ্ন {bn(i + 1)}</legend>
                  {qs.length > 1 && (
                    <button type="button" className={btnDanger} aria-label={`প্রশ্ন ${i + 1} মুছুন`} onClick={() => setQs(qs.filter((_, j) => j !== i))}>
                      <Icon name="x" className="size-4" />
                    </button>
                  )}
                </div>
                <input className={inputCls} aria-label={`প্রশ্ন ${i + 1}`} placeholder="প্রশ্নটি লিখুন" required value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
                {q.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input type="radio" className="size-4 accent-brand" name={`c${i}`} checked={q.correctIndex === k} onChange={() => setQ(i, { correctIndex: k })} aria-label={`অপশন ${k + 1} সঠিক উত্তর`} />
                    <input className={inputCls} aria-label={`অপশন ${k + 1}`} placeholder={`অপশন ${bn(k + 1)}`} required value={o} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} />
                  </div>
                ))}
                <p className="text-xs text-faint">রেডিও বাটনে সঠিক উত্তর বেছে নিন।</p>
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnGhost} onClick={() => setQs([...qs, blankQ()])}>
                <Icon name="plus" className="size-4" /> প্রশ্ন যোগ করুন
              </button>
              <button className={btnCls}>পরীক্ষা তৈরি করুন</button>
            </div>
            <p className="text-xs text-faint">তৈরির পর “পাবলিশ” করলে শিক্ষার্থীরা দেখতে পাবে।</p>
          </form>
        </Card>
      )}
      <ConfirmModal open={!!del} title="পরীক্ষা মুছবেন?" message={`“${del?.title}” ও এর সব ফলাফল মুছে যাবে।`} confirmLabel="মুছুন" onConfirm={() => del && act(() => api(`/exams/${del.id}`, { method: "DELETE" }))} onClose={() => setDel(null)} />
    </div>
  );
}

// ---------------- Students ----------------
type Enr = {
  id: string;
  status: string;
  createdAt: string;
  user: { name: string; email: string; phone: string | null };
  payments: { id: string; amount: number; method: string; trxId: string; status: string }[];
};
function StudentsTab({ id }: { id: string }) {
  const { items, error } = useList<Enr>(`/batches/${id}/students`);
  return (
    <div className="space-y-3">
      <ErrorMsg error={error} />
      {!items && <Loading />}
      {items?.length === 0 && <EmptyState icon="users" title="কোনো শিক্ষার্থী নেই" />}
      {items?.map((e) => (
        <Card key={e.id} className="text-sm">
          <p className="font-bold">
            {e.user.name} <Badge tone={e.status === "ACTIVE" ? "green" : e.status === "PENDING" ? "amber" : "red"}>{e.status === "ACTIVE" ? "সক্রিয়" : e.status === "PENDING" ? "অপেক্ষমাণ" : "বাতিল"}</Badge>
          </p>
          <p className="text-sub">{e.user.phone ?? e.user.email}</p>
          {e.payments.map((p) => (
            <p key={p.id} className="text-xs text-faint">
              ৳{p.amount} · {p.method} · {p.trxId} · {p.status}
            </p>
          ))}
        </Card>
      ))}
    </div>
  );
}
