"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Icon } from "./icons";
import { SupportChat, readStoredTicket } from "./support-chat";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS: Record<string, string[]> = {
  guest: ["কোন কোর্সে কত ফি?", "কীভাবে ভর্তি হব?", "পেমেন্ট কীভাবে করব?"],
  STUDENT: ["আমার কোর্সগুলো কী কী?", "আজ কোনো লাইভ ক্লাস আছে?", "আমার পরীক্ষার স্কোর কত?"],
  TEACHER: ["আমার কোন কোর্সগুলো আছে?", "আমার কী কী অ্যাক্সেস আছে?"],
  ADMIN: ["অপেক্ষমাণ পেমেন্ট কয়টি?", "কোন কোর্সে সবচেয়ে বেশি শিক্ষার্থী?", "মোট আয় কত?"],
};

// ---- tiny safe renderer: **bold**, [text](/path), bare /paths, "- " bullets. Never injects HTML. ----
const SITE_PATH = "(?:explore|checkout|batches|courses|dashboard|notices|payments|register|login|browse|admin)";
const INLINE = new RegExp(`(\\*\\*[^*]+\\*\\*|\\[[^\\]]+\\]\\(\\/[^)\\s]*\\)|(?<![\\w/(])\\/${SITE_PATH}[\\w\\-/]*)`, "g");

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((part, i) => {
        if (!part) return null;
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
        const md = part.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/);
        if (md) return <Chat href={md[2]} key={i}>{md[1]}</Chat>;
        if (new RegExp(`^\\/${SITE_PATH}`).test(part)) return <Chat href={part} key={i}>{part}</Chat>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** Only same-site relative links are ever rendered as links (no external URLs from model output). */
function Chat({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand underline underline-offset-2 hover:text-brand-dark">
      {children}
    </Link>
  );
}

function Rich({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
          {list.map((l, i) => (
            <li key={i}>
              <Inline text={l} />
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) list.push(item[1]);
    else {
      flush();
      if (line) blocks.push(<p key={`p${blocks.length}`} className="my-1"><Inline text={line} /></p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

export function ChatWidget() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // aiAvailable: null while unknown. Guests only get the AI tab when the server allows it.
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"ai" | "support">("ai");
  const [dot, setDot] = useState(false);
  const [handoff, setHandoff] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scope = user?.id ?? "guest";
  const storeKey = `chat:${scope}`;

  // Each identity keeps its own conversation; switching account never shows the previous one.
  useEffect(() => {
    if (loading) return;
    try {
      const saved = sessionStorage.getItem(storeKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMsgs(saved ? (JSON.parse(saved) as Msg[]) : []);
    } catch {
      setMsgs([]);
    }
  }, [storeKey, loading]);
  useEffect(() => {
    if (loading) return;
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(msgs.slice(-30)));
    } catch {}
  }, [msgs, storeKey, loading]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open]);
  useEffect(() => {
    if (open && tab === "ai") inputRef.current?.focus();
  }, [open, tab]);

  // Ask the server whether the AI tab is usable for this visitor; if not, show support only.
  useEffect(() => {
    if (loading) return;
    let live = true;
    api<{ ai: boolean }>("/chat/status")
      .then((r) => {
        if (!live) return;
        setAiAvailable(r.ai);
        setTab(r.ai ? "ai" : "support");
      })
      .catch(() => {
        if (live) {
          setAiAvailable(false);
          setTab("support");
        }
      });
    return () => {
      live = false;
    };
  }, [user?.id, loading]);

  // While the panel is closed, check now and then for a new staff reply (red dot on the launcher).
  useEffect(() => {
    if (loading || open) return;
    let stop = false;
    const tick = async () => {
      try {
        let id: string | null = null;
        let token: string | undefined;
        if (user) id = (await api<{ id: string | null }>("/support/mine")).id;
        else {
          const t = readStoredTicket();
          id = t?.id ?? null;
          token = t?.token;
        }
        if (!id) return;
        const r = await api<{ unread: boolean }>(`/support/tickets/${id}/unread`, { headers: token ? { "x-support-token": token } : undefined });
        if (!stop) setDot(r.unread);
      } catch {}
    };
    tick();
    const h = setInterval(tick, 45000);
    return () => {
      stop = true;
      clearInterval(h);
    };
  }, [open, user, loading]);

  // No assistant while someone is sitting an exam.
  if (loading || pathname.startsWith("/exams/")) return null;

  async function send(text: string) {
    const content = text.trim().slice(0, 600);
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const history = next.filter((m) => !m.error).slice(-8).map(({ role, content }) => ({ role, content }));
      const r = await api<{ reply: string }>("/chat", { body: { messages: history } });
      setMsgs([...next, { role: "assistant", content: r.reply }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: e instanceof Error ? e.message : "কিছু একটা ভুল হয়েছে।", error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const suggestions = SUGGESTIONS[user?.role ?? "guest"];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="চ্যাট সহায়ক খুলুন"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-brand px-5 py-3.5 text-white shadow-lg transition-colors hover:bg-brand-dark sm:bottom-6 sm:right-6"
        >
          <Icon name="chat" className="size-6" />
          <span className="hidden text-sm font-semibold sm:inline">{aiAvailable === false ? "সাপোর্ট" : "সহায়ক"}</span>
          {dot && <span className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full border-2 border-white bg-danger" role="status" aria-label="নতুন উত্তর এসেছে" />}
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="চ্যাট সহায়ক"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="fade-in fixed inset-x-2 bottom-2 z-50 flex h-[75vh] max-h-[40rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[34rem] sm:w-[24rem]"
        >
          <header className="bg-brand text-white">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-full bg-white/15">
                  <Icon name="chat" className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold leading-tight">{aiAvailable === false ? "সাপোর্ট" : "চ্যাট সহায়ক"}</p>
                  <p className="text-xs text-teal-100">{tab === "support" ? "সাপোর্ট টিম আপনাকে উত্তর দেবে" : "কোর্স, ভর্তি, পেমেন্ট ও ক্লাস নিয়ে জিজ্ঞাসা করুন"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {tab === "ai" && msgs.length > 0 && (
                  <button onClick={() => setMsgs([])} aria-label="নতুন চ্যাট শুরু করুন" title="নতুন চ্যাট" className="rounded-lg p-1.5 hover:bg-white/15">
                    <Icon name="plus" className="size-5" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="চ্যাট বন্ধ করুন" className="rounded-lg p-1.5 hover:bg-white/15">
                  <Icon name="x" className="size-5" />
                </button>
              </div>
            </div>
            {aiAvailable && (
              <div role="tablist" className="flex gap-1 px-3">
                {([["ai", "AI সহায়ক"], ["support", "সাপোর্ট"]] as const).map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={`relative rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === k ? "bg-canvas text-brand-dark" : "text-teal-100 hover:bg-white/10"}`}
                  >
                    {label}
                    {k === "support" && dot && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger" aria-label="নতুন উত্তর" />}
                  </button>
                ))}
              </div>
            )}
          </header>


          {tab === "support" ? (
            <SupportChat prefill={handoff} onRead={() => setDot(false)} />
          ) : (
            <>
          <div ref={logRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-canvas p-4 text-[15px]">
              {msgs.length === 0 && (
                <div className="space-y-3">
                  <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2.5 shadow-sm">
                    {user ? `হ্যালো ${user.name.split(" ")[0]}! আমি আপনাকে কীভাবে সাহায্য করতে পারি?` : "হ্যালো! কোর্স, ফি, ভর্তি বা পেমেন্ট নিয়ে যা জানতে চান জিজ্ঞাসা করুন।"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => send(s)} className="rounded-full border border-brand/30 bg-surface px-3 py-1.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-soft">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[88%] break-words rounded-2xl px-3.5 py-2 shadow-sm ${
                      m.role === "user" ? "rounded-tr-sm bg-brand text-white" : m.error ? "rounded-tl-sm bg-danger-soft text-danger" : "rounded-tl-sm bg-surface text-ink"
                    }`}
                  >
                    {m.role === "user" ? m.content : <Rich text={m.content} />}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start" role="status" aria-label="উত্তর লেখা হচ্ছে">
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-surface px-4 py-3 shadow-sm">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="size-2 animate-bounce rounded-full bg-faint" style={{ animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
  
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-line bg-surface p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={600}
                  placeholder="আপনার প্রশ্ন লিখুন…"
                  aria-label="আপনার প্রশ্ন"
                  className="min-h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button disabled={busy || !input.trim()} aria-label="পাঠান" className="grid size-10 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-dark disabled:opacity-50">
                  <Icon name="send" className="size-5" />
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-faint">
                  এটি AI সহায়ক। ফি/তারিখের মতো গুরুত্বপূর্ণ তথ্য কোর্স পেজে মিলিয়ে নিন।{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setHandoff([...msgs].reverse().find((m) => m.role === "user")?.content ?? "");
                      setTab("support");
                    }}
                    className="font-semibold text-brand hover:underline"
                  >
                    মানুষের সাথে কথা বলুন
                  </button>
                </p>
            </form>
            </>
          )}
        </section>
      )}
    </>
  );
}
