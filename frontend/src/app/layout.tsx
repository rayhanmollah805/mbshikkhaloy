import type { Metadata } from "next";
import { Hind_Siliguri } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

// Hind Siliguri covers both Bengali and Latin glyphs in one family.
const hind = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "আমাদের বিদ্যালয়",
  description: "অনলাইন ক্লাস, নোট, পরীক্ষা ও ভর্তি ব্যবস্থাপনা",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" className={`${hind.variable} h-full`}>
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
