"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Shield } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { useIsAdmin } from "@/lib/useIsAdmin";

export default function AdminPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  if (adminLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">権限を確認しています...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">管理者のみアクセスできます</p>
            <p className="text-sm text-muted-foreground">管理者に問い合わせてください。</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-16 md:py-24 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl pt-12 md:pt-0">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">ADMIN</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">管理</h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                  管理者メニューからイベントやユーザー管理を行えます。
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4 md:gap-6">
                <Link href="/admin/events" className="group">
                  <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                    <div className="relative h-full flex flex-col">
                      <Calendar className="w-6 md:w-8 h-6 md:h-8 text-primary mb-3 md:mb-4" />
                      <h3 className="text-base md:text-lg font-bold mb-2">イベント管理</h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        イベントの作成・編集・ステータス更新
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>開く</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/admin/roles" className="group">
                  <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                    <div className="relative h-full flex flex-col">
                      <Shield className="w-6 md:w-8 h-6 md:h-8 text-primary mb-3 md:mb-4" />
                      <h3 className="text-base md:text-lg font-bold mb-2">ユーザー管理</h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        Administrator/Supervisor が役職・crew・part を更新
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>開く</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
