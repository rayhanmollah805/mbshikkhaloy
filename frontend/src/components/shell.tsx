"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fileUrl } from "@/lib/api";
import { useRequireUser, type Role } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { ChatWidget } from "./chat-widget";
import { Icon, type IconName } from "./icons";
import { LogoMark } from "./logo";
import { Avatar, Badge, Skeleton } from "./ui";
import { SITE_NAME } from "@/lib/brand";
import { ProfileModal } from "./profile-modal";
import { useDarkMode } from "./theme";

type NavItem = { href: string; label: string; icon: IconName };

const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "ড্যাশবোর্ড", icon: "chart" },
    { href: "/admin/courses", label: "কোর্স", icon: "book" },
    { href: "/admin/teachers", label: "শিক্ষক ও অ্যাক্সেস", icon: "teacher" },
    { href: "/admin/students", label: "শিক্ষার্থী", icon: "users" },
    { href: "/admin/payments", label: "পেমেন্ট", icon: "card" },
    { href: "/admin/dues", label: "বকেয়া ও মেয়াদ", icon: "clock" },
    { href: "/admin/coupons", label: "কুপন", icon: "taka" },
    { href: "/admin/support", label: "সাপোর্ট", icon: "chat" },
    { href: "/notices", label: "নোটিশ", icon: "bell" },
    { href: "/admin/audit", label: "অডিট লগ", icon: "clipboard" },
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
    { href: "/community", label: "কমিউনিটি", icon: "chat" },
    { href: "/reports", label: "রিপোর্ট", icon: "chart" },
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
  const { dark, toggle } = useDarkMode();
  const [profile, setProfile] = useState(false);
  const [unread, setUnread] = useState(0);

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

  // Bell: notices newer than the last time the notice page was opened.
  const uid = user?.id;
  useEffect(() => {
    if (!uid) return;
    const KEY = "notices_seen";
    if (pathname === "/notices") {
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {
        /* storage blocked */
      }
      setUnread(0); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    let stop = false;
    const tick = () =>
      api<{ createdAt: string }[]>("/notices")
        .then((rows) => {
          let seen = 0;
          try {
            seen = Number(localStorage.getItem(KEY)) || 0;
          } catch {
            /* storage blocked */
          }
          if (!stop) setUnread(rows.filter((n) => new Date(n.createdAt).getTime() > seen).length);
        })
        .catch(() => undefined);
    tick();
    const h = setInterval(tick, 60000);
    return () => {
      stop = true;
      clearInterval(h);
    };
  }, [uid, pathname]);

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
            <button onClick={toggle} aria-pressed={dark} aria-label={dark ? "লাইট মোড" : "ডার্ক মোড"} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas">
              <Icon name={dark ? "sun" : "moon"} className="size-4" />
              <span className="hidden sm:inline">{dark ? "লাইট মোড" : "ডার্ক মোড"}</span>
            </button>
            <Link href="/notices" aria-label={unread ? `${unread}টি নতুন নোটিশ` : "নোটিশ"} className="relative rounded-full p-2 text-ink hover:bg-canvas">
              <Icon name="bell" />
              {unread > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            {user.role === "STUDENT" ? (
              <button onClick={() => setProfile(true)} aria-label="প্রোফাইল সম্পাদনা" className="rounded-full">
                <Avatar name={user.name} src={user.photoUrl ? fileUrl(user.photoUrl) : null} />
              </button>
            ) : (
              <Avatar name={user.name} src={user.photoUrl ? fileUrl(user.photoUrl) : null} />
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
      {user.role === "STUDENT" && profile && <ProfileModal user={user} open onClose={() => setProfile(false)} />}
      <ChatWidget />
    </div>
  );
}
