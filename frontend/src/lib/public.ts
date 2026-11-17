"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

export type PublicCourse = {
  id: string;
  slug?: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  isPaid: boolean;
  fee: number;
  billing?: "ONCE" | "MONTHLY";
  duration: string | null;
  teachers: string[];
  students: number;
  materials: number;
  exams: number;
};

export type PublicCourseDetail = Omit<PublicCourse, "materials" | "exams"> & {
  highlights: string[];
  routines: { dayOfWeek: number; startTime: string; endTime: string; subject: string }[];
  materials: { type: "PDF" | "VIDEO"; title: string }[];
  exams: { title: string; durationMin: number; questions: number }[];
  liveClasses: number;
};

export type SiteInfo = {
  stats: { students: number; courses: number; teachers: number };
  settings: { bkash: string; nagad: string; rocket: string; bank: string; supportPhone: string; supportEmail: string; siteName: string; siteTagline: string; announcements: string };
};

/** Fetches a public endpoint once. `data` stays null until loaded. */
export function usePublic<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<T>(path)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [path]);
  return { data, error };
}

export type EnrollState = "loading" | "guest" | "staff" | "none" | "PENDING" | "ACTIVE" | "REJECTED";

/** The signed-in student's enrolment status for one course. */
export function useEnrollState(courseId: string) {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<EnrollState>("loading");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!courseId) {
      // Course not loaded yet (pages are opened by slug).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("loading");
      return;
    }
    if (loading) return;
    if (!user) {
      // Auth state is only known after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("guest");
      return;
    }
    if (user.role !== "STUDENT") {
      setStatus("staff");
      return;
    }
    let live = true;
    api<{ id: string; enrollment: { status: "PENDING" | "ACTIVE" | "REJECTED" } | null }[]>("/batches")
      .then((all) => live && setStatus(all.find((c) => c.id === courseId)?.enrollment?.status ?? "none"))
      .catch(() => live && setStatus("none"));
    return () => {
      live = false;
    };
  }, [user, loading, courseId, tick]);

  return { status, refresh: () => setTick((t) => t + 1) };
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Admin-entered notices: one per line, blank lines dropped, capped for the page. */
export function parseAnnouncements(raw: string | undefined): string[] {
  return (raw ?? "")
    .split("\n")
    .map((l) => l.trim().slice(0, 140))
    .filter(Boolean)
    .slice(0, 8);
}
