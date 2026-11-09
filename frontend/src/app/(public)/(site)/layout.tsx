import { Suspense } from "react";
import { ChatWidget } from "@/components/chat-widget";
import { PublicFooter, PublicNav } from "@/components/public-shell";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicNav />
      <main className="flex-1">{children}</main>
      <PublicFooter />
      {/* usePathname inside the widget is dynamic on [id] routes, so it needs Suspense. */}
      <Suspense>
        <ChatWidget />
      </Suspense>
    </div>
  );
}
