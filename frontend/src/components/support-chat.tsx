"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Icon } from "./icons";

type TMsg = { id: string; sender: "USER" | "STAFF"; authorName: string | null; body: string; createdAt: string };
type Ticket = { id: string; status: "OPEN" | "CLOSED"; name: string; unread: boolean; messages: TMsg[] };

const STORE = "support:ticket";
export const readStoredTicket = (): { id: string; token: string } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null");
    return v?.id && v?.token ? v : null;
  } catch {
    return null;
  }
};
const tokenHeader = (token?: string) => (token ? { "x-support-token": token } : undefined);

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20";

const fmtTime = (d: string) => new Date(d).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });

/**
 * Human support thread. Signed-in users are matched by account; guests keep a private
 * token in this browser (localStorage) and send it as a header, so only they can read it.
 */
export function SupportChat({ prefill = "", onRead }: { prefill?: string; onRead?: () => void }) {
  const { user, loading } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [state, setState] = useState<"loading" | "form" | "thread">("loading");
  const [token, setToken] = useState<string | undefined>();
  const [f, setF] = useState({ name: "", contact: "", message: prefill });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (id: string, tk?: string) => {
      const t = await api<Ticket>(`/support/tickets/${id}`, { headers: tokenHeader(tk) });
      setTicket(t);
      setState("thread");
      onRead?.();
    },
    [onRead],
  );

  // Find an existing conversation for this identity.
  useEffect(() => {
    if (loading) return;
    let live = true;
    (async () => {
      try {
        if (user) {
          const { id } = await api<{ id: string | null }>("/support/mine");
          if (!live) return;
          if (id) return await load(id);
        } else {
          const s = readStoredTicket();
          if (s) {
            setToken(s.token);
            return await load(s.id, s.token);
          }
        }
        if (live) setState("form");
      } catch {
        // Stale/foreign ticket: forget it and start fresh.
        if (!user) localStorage.removeItem(STORE);
        if (live) setState("form");
      }
    })();
    return () => {
      live = false;
    };
  }, [user, loading, load]);

  // Poll for staff replies while this panel is open.
  useEffect(() => {
    if (state !== "thread" || !ticket) return;
    const h = setInterval(() => {
      load(ticket.id, token).catch(() => undefined);
    }, 8000);
    return () => clearInterval(h);
  }, [state, ticket?.id, token, load]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [ticket?.messages.length, state]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const t = await api<Ticket & { token: string | null }>("/support/tickets", { body: f });
      if (t.token) {
        localStorage.setItem(STORE, JSON.stringify({ id: t.id, token: t.token }));
        setToken(t.token);
      }
      setTicket(t);
      setState("thread");
    } catch (err) {
      setError(err instanceof Error ? err.message : "পাঠানো যায়নি");
    } finally {
      setBusy(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !reply.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setTicket(await api<Ticket>(`/support/tickets/${ticket.id}/messages`, { body: { message: reply }, headers: tokenHeader(token) }));
      setReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "পাঠানো যায়নি");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas text-sm text-faint" role="status">
        লোড হচ্ছে…
      </div>
    );
  }

  if (state === "form") {
    return (
      <form onSubmit={create} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-canvas p-4">
        <div className="rounded-xl bg-surface p-3.5 text-sm text-sub shadow-sm">
          <p className="mb-1 font-semibold text-ink">সাপোর্ট টিমকে লিখুন</p>
          আপনার সমস্যা বা প্রশ্ন লিখুন। আমাদের টিম উত্তর দিলে এখানেই দেখতে পাবেন।
          {!user && " পেজ বন্ধ করলেও এই ব্রাউজারে কথোপকথন থাকবে।"}
        </div>
        {!user && (
          <>
            <label className="block text-sm font-medium">
              আপনার নাম
              <input className={`${inputCls} mt-1`} required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
            </label>
            <label className="block text-sm font-medium">
              মোবাইল নম্বর বা ইমেইল
              <input className={`${inputCls} mt-1`} required maxLength={120} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} autoComplete="email" />
            </label>
          </>
        )}
        <label className="block text-sm font-medium">
          আপনার বার্তা
          <textarea className={`${inputCls} mt-1`} required rows={4} maxLength={1000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50">
          <Icon name="send" className="size-4" /> {busy ? "পাঠানো হচ্ছে…" : "পাঠান"}
        </button>
        {user && <p className="text-center text-xs text-faint">আপনার অ্যাকাউন্টের নাম ও যোগাযোগের তথ্য ব্যবহার করা হবে।</p>}
      </form>
    );
  }

  const t = ticket!;
  return (
    <>
      <div ref={logRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-canvas p-4 text-[15px]">
        {t.messages.map((m) => (
          <div key={m.id} className={m.sender === "USER" ? "flex justify-end" : "flex justify-start"}>
            <div className="max-w-[88%]">
              {m.sender === "STAFF" && <p className="mb-0.5 ml-1 text-xs font-semibold text-brand-dark">সাপোর্ট টিম</p>}
              <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 shadow-sm ${m.sender === "USER" ? "rounded-tr-sm bg-brand text-white" : "rounded-tl-sm bg-surface text-ink"}`}>{m.body}</div>
              <p className={`mt-0.5 text-[11px] text-faint ${m.sender === "USER" ? "text-right" : "ml-1"}`}>{fmtTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
        {!t.messages.some((m) => m.sender === "STAFF") && (
          <p className="rounded-lg bg-surface px-3 py-2 text-center text-xs text-sub shadow-sm">আপনার বার্তা পাঠানো হয়েছে। সাপোর্ট টিম উত্তর দিলে এখানে দেখা যাবে।</p>
        )}
        {t.status === "CLOSED" && <p className="text-center text-xs text-faint">এই কথোপকথন বন্ধ করা হয়েছে। নতুন বার্তা লিখলে আবার খুলবে।</p>}
      </div>
      <form onSubmit={send} className="border-t border-line bg-surface p-3">
        {error && (
          <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-1.5 text-xs text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <input value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} placeholder="বার্তা লিখুন…" aria-label="সাপোর্টকে বার্তা" className="min-h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
          <button disabled={busy || !reply.trim()} aria-label="পাঠান" className="grid size-10 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-dark disabled:opacity-50">
            <Icon name="send" className="size-5" />
          </button>
        </div>
        {!user && (
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(STORE);
              setTicket(null);
              setToken(undefined);
              setF({ name: t.name, contact: "", message: "" });
              setState("form");
            }}
            className="mt-2 w-full text-center text-xs font-medium text-brand hover:underline"
          >
            নতুন সাপোর্ট রিকোয়েস্ট শুরু করুন
          </button>
        )}
      </form>
    </>
  );
}
