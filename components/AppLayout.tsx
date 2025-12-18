// components/AppLayout.tsx
import type { ReactNode } from "react";
import { SideNav } from "@/components/SideNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SideNav />
      <main className="flex-1 md:ml-20">{children}</main>
    </div>
  );
}
