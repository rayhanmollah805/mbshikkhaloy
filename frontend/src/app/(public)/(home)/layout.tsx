import { Suspense } from "react";
import { ChatWidget } from "@/components/chat-widget";
import { HomeHeader } from "@/components/home-header";
import { PublicFooter } from "@/components/public-shell";

/** Home page has its own header and a green theme (token overrides in globals.css). */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-green flex min-h-screen flex-col bg-canvas">
      <HomeHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
      <Suspense>
        <ChatWidget />
      </Suspense>
    </div>
  );
}
