"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LiveStudio } from "@/components/live-studio";
import { LiveViewer, type LiveInfo } from "@/components/live-viewer";
import { Badge, ErrorMsg, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { api } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

export default function LivePage() {
  const user = useRequireUser();
  const { id } = useParams<{ id: string }>();
  const [live, setLive] = useState<LiveInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"studio" | "view">("studio");

  const load = useCallback(() => {
    api<LiveInfo>(`/live/${id}`)
      .then(setLive)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [user, load]);

  // Keep the page in step with the server: class starts, ends at its end time, etc.
  const active = !!live && live.provider === "YOUTUBE" && live.status !== "ENDED";
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [active, load]);

  // Attendance: a student with the live class open reports in every 30 seconds.
  const watching = user?.role === "STUDENT" && live?.status === "LIVE";
  useEffect(() => {
    if (!watching) return;
    const beat = () => api(`/live/${id}/heartbeat`, { method: "POST", body: {} }).catch(() => undefined);
    beat();
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, [watching, id]);

  if (!user) return null;
  return (
    <div className="fade-in">
      <Link href={live ? `/batches/${live.batchId}` : "/dashboard"} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        ← কোর্সে ফিরুন
      </Link>
      <ErrorMsg error={error} />
      {!live && !error && <Skeleton className="h-96" />}
      {live && (
        <>
          <PageHeader title={live.title} subtitle={live.batch.title} action={live.status === "LIVE" ? <Badge tone="red">● LIVE</Badge> : undefined} />
          {user.role === "STUDENT" && (
            <Link href={`/batches/${live.batchId}?tab=doubts&ref=${encodeURIComponent(live.title)}`} className="-mt-2 mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              এই ক্লাস নিয়ে প্রশ্ন আছে? প্রশ্ন করুন →
            </Link>
          )}
          {live.canManage && live.provider === "YOUTUBE" ? (
            <>
              <Tabs
                tabs={[
                  { key: "studio" as const, label: "স্টুডিও", icon: "radio" as const },
                  { key: "view" as const, label: "শিক্ষার্থীর ভিউ", icon: "users" as const },
                ]}
                value={tab}
                onChange={setTab}
              />
              {tab === "studio" ? <LiveStudio id={id} initialStatus={live.status} videoId={live.videoId} endsAt={live.endsAt} onChange={load} /> : <LiveViewer live={live} />}
            </>
          ) : (
            <LiveViewer live={live} />
          )}
        </>
      )}
    </div>
  );
}
