"use client";

import { useEffect, useState } from "react";
import { Badge, Card, fmtDate } from "@/components/ui";

export type LiveInfo = {
  id: string;
  batchId: string;
  title: string;
  url: string;
  startsAt: string;
  endsAt: string | null;
  isLive: boolean;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  provider: "MANUAL" | "YOUTUBE";
  videoId: string | null;
  batch: { title: string };
  canManage: boolean;
};

/** Student view: YouTube player + YouTube live chat embedded side by side. */
export function LiveViewer({ live }: { live: LiveInfo }) {
  const [host, setHost] = useState("");
  useEffect(() => {
    // The chat embed needs the page's own hostname; only known in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(location.hostname);
  }, []);

  if (live.provider === "MANUAL") {
    return (
      <Card className="space-y-3 text-center">
        <p className="text-sub">এই ক্লাসটি বাইরের লিংকে (Meet/Zoom) হচ্ছে।</p>
        {live.isLive ? (
          <a href={live.url} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-danger px-5 py-2.5 font-semibold text-white hover:opacity-90">
            Live Class এ যোগ দিন
          </a>
        ) : (
          <p className="text-faint">এখনো শুরু হয়নি</p>
        )}
      </Card>
    );
  }

  if (live.status === "SCHEDULED") {
    return (
      <Card className="py-16 text-center">
        <p className="text-lg font-bold">ক্লাস এখনো শুরু হয়নি</p>
        <p className="mt-1 text-sub">
          নির্ধারিত সময়: {fmtDate(live.startsAt)}
          {live.endsAt && <> – {new Date(live.endsAt).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" })}</>}
        </p>
        <p className="mt-3 text-sm text-faint">শিক্ষক শুরু করলে এই পেজেই ক্লাস চালু হবে, রিফ্রেশ করতে হবে না।</p>
      </Card>
    );
  }

  const ended = live.status === "ENDED";
  if (ended && !live.videoId) {
    return (
      <Card className="py-16 text-center">
        <p className="text-lg font-bold">এই ক্লাসটি হয়নি</p>
        <p className="mt-1 text-sub">নির্ধারিত সময়ে শিক্ষক লাইভ শুরু করেননি, তাই কোনো রেকর্ডিং নেই।</p>
      </Card>
    );
  }
  const src = `https://www.youtube.com/embed/${live.videoId}?autoplay=${ended ? 0 : 1}&rel=0&modestbranding=1`;
  const chat = `https://www.youtube.com/live_chat?v=${live.videoId}&embed_domain=${host}`;
  return (
    <div className={ended ? "max-w-4xl" : "grid gap-4 lg:grid-cols-[1fr_360px]"}>
      <div>
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe title={live.title} src={src} className="size-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ended ? <Badge tone="slate">ক্লাস শেষ — রেকর্ডিং</Badge> : <Badge tone="red">● LIVE</Badge>}
          <span className="text-sm text-sub">
            {ended ? "রেকর্ডিং প্রসেস হতে শেষ হওয়ার পর কিছুক্ষণ সময় লাগতে পারে; ভিডিও না চললে একটু পরে রিফ্রেশ করুন।" : "ভিডিও না চললে একটু অপেক্ষা করুন; ২–১০ সেকেন্ড দেরি হওয়া স্বাভাবিক।"}
          </span>
        </div>
      </div>
      {!ended && (
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-line bg-surface lg:h-[calc(56.25vw*0.62)] lg:max-h-[640px]">
          <p className="border-b border-line px-3 py-2 text-sm font-bold">লাইভ চ্যাট</p>
          {host ? <iframe title="লাইভ চ্যাট" src={chat} className="min-h-0 flex-1" /> : <p className="p-4 text-sm text-sub">লোড হচ্ছে…</p>}
          <p className="border-t border-line px-3 py-2 text-xs text-sub">চ্যাটে লিখতে আপনার YouTube/Google অ্যাকাউন্টে সাইন-ইন থাকতে হবে।</p>
        </div>
      )}
    </div>
  );
}
