// components/AppLayout.tsx
import Link from "next/link";
import type { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="w-full bg-white border-b">
        <div className="max-w-5xl mx-auto h-14 flex items-center justify-between px-4">
          <Link href="/" className="font-semibold">
            Jacla Portal
          </Link>
          <nav className="flex gap-4 text-sm text-gray-600">
            <Link href="/events">イベント</Link>
            <Link href="/me">マイページ</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

