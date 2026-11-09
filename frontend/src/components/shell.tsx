"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireUser, type Role } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { ChatWidget } from "./chat-widget";
import { Icon, type IconName } from "./icons";
import { LogoMark } from "./logo";
import { Avatar, Badge, Skeleton } from "./ui";
import { SITE_NAME } from "@/lib/brand";

type NavItem = { href: string; label: string; icon: IconName };

const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "ড্যাশবোর্ড", icon: "chart" },
    { href: "/admin/courses", label: "কোর্স", icon: "book" },
    { href: "/admin/teachers", label: "শিক্ষক ও অ্যাক্সেস", icon: "teacher" },
    { href: "/admin/students", label: "শিক্ষার্থী", icon: "users" },
    { href: "/admin/payments", label: "পেমেন্ট", icon: "card" },
    { href: "/admin/support", label: "সাপোর্ট", icon: "chat" },
    { href: "/notices", label: "নোটিশ", icon: "bell" },
    { href: "/admin/settings", label: "সেটিংস", icon: "shield" },
  ],
  TEACHER: [
    { href: "/dashboard", label: "ড্যাশবোর্ড", icon: "home" },
    { href: "/courses", label: "আমার কোর্স", icon: "book" },
    { href: "/payments", label: "পেমেন্ট", icon: "card" },
    { href: "/notices", label: "নোটিশ", icon: "bell" },
  ],
  STUDENT: [
    { href: "/dashboard", label: "ড্যাশবোর্ড", icon: "home" },
    { href: "/courses", label: "আমার কোর্স", icon: "book" },
    { href: "/browse", label: "কোর্স ভর্তি", icon: "plus" },
    { href: "/notices", label: "নোটিশ", icon: "bell" },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "অ্যাডমিন",
  TEACHER: "শিক্ষক",
  STUDENT: "শিক্ষার্থী",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useRequireUser();
  const { logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [supportCount, setSupportCount] = useState(0);

  const isAdmin = user?.role === "ADMIN";
  // Unread support conversations -> badge on the sidebar item (admins only).
  useEffect(() => {
    if (!isAdmin) return;
    let stop = false;
    const tick = () =>
      api<{ count: number }>("/admin/support/unread")
        .then((r) => !stop && setSupportCount(r.count))
        .catch(() => undefined);
    tick();
    const h = setInterval(tick, 30000);
    return () => {
      stop = true;
      clearInterval(h);
    };
  }, [isAdmin, pathname]);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const items = NAV[user.role];
  // Longest matching href wins so /admin doesn't light up on /admin/courses.
  const active = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))?.href;

  const sidebar = (
    <nav className="flex h-full flex-col bg-side text-slate-200" aria-label="প্রধান মেনু">
      <Link href="/" className="flex items-center gap-3 px-5 py-5">
        <LogoMark className="size-9" light />
        <span className="text-lg font-bold text-white">{SITE_NAME}</span>
      </Link>
      <ul className="flex-1 space-y-1 px-3">
        {items.map((i) => {
          const on = i.href === active;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                onClick={() => setOpen(false)}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
                  on ? "bg-side-hover text-white" : "text-slate-300 hover:bg-side-hover/70 hover:text-white"
                }`}
              >
                <Icon name={i.icon} className={`size-5 ${on ? "text-teal-300" : ""}`} />
                {i.label}
                {i.href === "/admin/support" && supportCount > 0 && (
                  <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white" aria-label={`${supportCount}টি অপঠিত`}>
                    {supportCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-white/10 p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-slate-300 transition-colors hover:bg-side-hover/70 hover:text-white"
        >
          <Icon name="logout" className="size-5" />
          লগআউট
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="fade-in absolute inset-y-0 left-0 w-72">{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-8">
          <button
            onClick={() => setOpen(true)}
            aria-label="মেনু খুলুন"
            className="rounded-lg p-2 text-ink hover:bg-canvas lg:hidden"
          >
            <Icon name="menu" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-ink">{user.name}</p>
              <p className="text-xs text-faint">{user.email}</p>
            </div>
            <Badge tone="brand">{ROLE_LABEL[user.role]}</Badge>
            <Avatar name={user.name} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
      <ChatWidget />
    </div>
  );
}
