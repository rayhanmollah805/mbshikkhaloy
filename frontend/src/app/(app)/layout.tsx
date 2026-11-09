import { Suspense } from "react";
import { AppShell } from "@/components/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Suspense: the shell reads the pathname, which is dynamic on [id] routes.
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
