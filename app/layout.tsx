import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "saehanFEMS · 설비 비가동 분석",
  description: "새한프라텍 공장 설비 비가동 분석 대시보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <header className="bg-gradient-to-r from-brand-deep to-brand text-white shadow-md no-print">
          <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <Link href="/" className="text-xl font-bold">saehanFEMS</Link>
              <span className="text-xs opacity-80">공장 설비 비가동 분석 대시보드</span>
            </div>
            <nav className="flex gap-5 text-sm">
              <Link href="/" className="hover:opacity-80">대시보드</Link>
              <Link href="/upload" className="hover:opacity-80">업로드</Link>
              <Link href="/settings" className="hover:opacity-80">설정</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-[1400px] mx-auto px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
