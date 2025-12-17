"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function RouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useAuth();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!isLoginPage && !session) router.replace("/login");
  }, [loading, session, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;
  if (loading) return <div className="p-4">Loading...</div>;
  if (!session) return null;

  return <>{children}</>;
}
