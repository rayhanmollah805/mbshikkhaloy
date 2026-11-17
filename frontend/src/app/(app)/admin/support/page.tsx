"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Avatar, Badge, EmptyState, ErrorMsg, PageHeader, Skeleton, btnCls, btnGhost, fmtDate, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

type Row = {
  id: string;
  name: string;
  contact: string | null;
  status: "OPEN" | "CLOSED";
  staffUnread: boolean;
  isUser: boolean;
  updatedAt: string;
  last: { sender: "USER" | "STAFF"; body: string } | null;
};
type Msg = { id: string; sender: "USER" | "STAFF"; authorName: string | null; body: string; createdAt: string };
type Detail = {
  id: string;
  name: string;
  contact: string | null;
  status: "OPEN" | "CLOSED";
  user: { email: string; phone: string | null; role: string } | null;
  messages: Msg[];
};

const FILTERS = [
  { key: "open", label: "খোলা" },
  { key: "all", label: "সব" },
  { key: "closed", label: "বন্ধ" },
] as const;

export default function AdminSupport() {
  const user = useRequireUser("ADMIN");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(() => api<Row[]>(`/admin/support?status=${filter}`).then(setRows), [filter]);
  const loadDetail = useCallback((id: string) => api<Detail>(`/admin/support/${id}`).then(setDetail), []);

  useEffect(() => {
    if (!user) return;
    // Initial fetch + 15s refresh of the inbox.
     
    loadList().catch((e) => setError(e.message));
    const h = setInterval(() => loadList().catch(() => undefined), 15000);
    return () => clearInterval(h);
  }, [user, loadList]);

  useEffect(() => {
    if (!user || !selected) return;
    loadDetail(selected).catch((e) => setError(e.message));
    const h = setInterval(() => loadDetail(selected).catch(() => undefined), 10000);
    return () => clearInterval(h);
  }, [user, selected, loadDetail]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [detail?.messages.length, selected]);

  if (!user) return null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setDetail(await api<Detail>(`/admin/support/${selected}/reply`, { body: { message: reply } }));
      setReply("");
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "OPEN" | "CLOSED") {
    if (!selected) return;
    setError(null);
    try {
      setDetail(await api<Detail>(`/admin/support/${selected}`, { method: "PATCH", body: { status } }));
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ব্যর্থ");
    }
  }

  return (
    <div className="fade-in">
      <PageHeader title="সাপোর্ট ইনবক্স" subtitle="ভিজিটর ও শিক্ষার্থীদের পাঠানো বার্তা — এখান থেকে উত্তর দিন" />
      <ErrorMsg error={error} />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {/* Inbox */}
        <div className={`${selected ? "hidden lg:block" : ""}`}>
          <div role="group" aria-label="ফিল্টার" className="mb-3 flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFilter(f.key);
                  setRows(null);
                }}
                aria-pressed={filter === f.key}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${filter === f.key ? "border-brand bg-brand text-white" : "border-line bg-surface text-sub hover:bg-canvas"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {!rows && <Skeleton className="h-40" />}
          {rows?.length === 0 && <EmptyState icon="chat" title="কোনো বার্তা নেই" hint="নতুন সাপোর্ট রিকোয়েস্ট এলে এখানে দেখা যাবে।" />}
          <ul className="space-y-2">
            {rows?.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => {
                    setDetail(null);
                    setSelected(r.id);
                  }}
                  aria-current={selected === r.id}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${selected === r.id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-canvas"}`}
                >
                  <Avatar name={r.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{r.name}</p>
                      {r.staffUnread && <span className="size-2.5 shrink-0 rounded-full bg-danger" aria-label="অপঠিত" />}
                    </div>
                    <p className="truncate text-sm text-sub">
                      {r.last?.sender === "STAFF" && <span className="text-faint">আপনি: </span>}
                      {r.last?.body}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-faint">
                      {fmtDate(r.updatedAt)}
                      {r.isUser && <Badge tone="brand">অ্যাকাউন্ট</Badge>}
                      {r.status === "CLOSED" && <Badge>বন্ধ</Badge>}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Thread */}
        <div className={`${selected ? "" : "hidden lg:block"}`}>
          {!selected && <EmptyState icon="chat" title="একটি কথোপকথন বেছে নিন" />}
          {selected && !detail && <Skeleton className="h-96" />}
          {selected && detail && (
            <section className="flex h-[70vh] min-h-[28rem] flex-col overflow-hidden rounded-xl border border-line bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-canvas lg:hidden" aria-label="তালিকায় ফিরুন">
                    <Icon name="arrow" className="size-5 rotate-180" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{detail.name}</p>
                    <p className="truncate text-xs text-sub">
                      {detail.user ? `${detail.user.email}${detail.user.phone ? ` · ${detail.user.phone}` : ""} · অ্যাকাউন্ট (${detail.user.role === "STUDENT" ? "শিক্ষার্থী" : detail.user.role === "TEACHER" ? "শিক্ষক" : "অ্যাডমিন"})` : `${detail.contact ?? "—"} · অতিথি`}
                    </p>
                  </div>
                </div>
                {detail.status === "OPEN" ? (
                  <button className={btnGhost} onClick={() => setStatus("CLOSED")}>
                    <Icon name="check" className="size-4" /> বন্ধ করুন
                  </button>
                ) : (
                  <button className={btnGhost} onClick={() => setStatus("OPEN")}>
                    আবার খুলুন
                  </button>
                )}
              </header>
              <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas p-4">
                {detail.messages.map((m) => (
                  <div key={m.id} className={m.sender === "STAFF" ? "flex justify-end" : "flex justify-start"}>
                    <div className="max-w-[80%]">
                      <p className={`mb-0.5 text-xs font-semibold ${m.sender === "STAFF" ? "mr-1 text-right text-brand-dark" : "ml-1 text-sub"}`}>{m.sender === "STAFF" ? (m.authorName ?? "সাপোর্ট") : detail.name}</p>
                      <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 shadow-sm ${m.sender === "STAFF" ? "rounded-tr-sm bg-brand text-white" : "rounded-tl-sm bg-surface text-ink"}`}>{m.body}</div>
                      <p className={`mt-0.5 text-[11px] text-faint ${m.sender === "STAFF" ? "text-right" : "ml-1"}`}>{fmtDate(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(e);
                  }}
                  rows={2}
                  maxLength={2000}
                  placeholder="উত্তর লিখুন… (Ctrl+Enter পাঠায়)"
                  aria-label="উত্তর"
                  className={`${inputCls} resize-none`}
                />
                <button className={`${btnCls} self-end`} disabled={busy || !reply.trim()}>
                  <Icon name="send" className="size-4" /> পাঠান
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
