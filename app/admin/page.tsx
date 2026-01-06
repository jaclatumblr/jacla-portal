"use client";

import Link from "next/link";
import { ArrowRight, Bell, Calendar, ClipboardList, MessageSquare, Shield } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { useRoleFlags } from "@/lib/useRoleFlags";

export default function AdminPage() {
  const {
    isAdmin,
    isPaLeader,
    isLightingLeader,
    canAccessAdmin,
    loading: roleLoading,
  } = useRoleFlags();
  const canAccessRoles = isAdmin || isPaLeader || isLightingLeader;

  if (roleLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">権限を確認しています...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!canAccessAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">管理者のみアクセスできます。</p>
            <p className="text-sm text-muted-foreground">管理者にお問い合わせください。</p>
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
          <PageHeader
            kicker="Admin"
            title="管理ダッシュボード"
            description="管理メニューからイベントやユーザー管理が行えます。"
            size="lg"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4 md:gap-6">
                {isAdmin && (
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
                )}

                {canAccessRoles && (
                  <Link href="/admin/roles" className="group">
                    <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                      <div className="relative h-full flex flex-col">
                        <Shield className="w-6 md:w-8 h-6 md:h-8 text-primary mb-3 md:mb-4" />
                        <h3 className="text-base md:text-lg font-bold mb-2">ユーザー管理</h3>
                        <p className="text-xs md:text-sm text-muted-foreground flex-1">
                          Administrator/Supervisor は全権限、PA/照明長は job のみ編集
                        </p>
                        <div className="flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>開く</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                <Link href="/admin/announcements" className="group">
                  <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                    <div className="relative h-full flex flex-col">
                      <Bell className="w-6 md:w-8 h-6 md:h-8 text-primary mb-3 md:mb-4" />
                      <h3 className="text-base md:text-lg font-bold mb-2">お知らせ管理</h3>
                      <p className="text-xs md:text-sm text-muted-foreground flex-1">
                        公開/下書き・固定表示・カテゴリを管理
                      </p>
                      <div className="flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>開く</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>

                {isAdmin && (
                  <Link href="/admin/forms" className="group">
                    <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                      <div className="relative h-full flex flex-col">
                        <ClipboardList className="w-6 md:w-8 h-6 md:h-8 text-primary mb-3 md:mb-4" />
                        <h3 className="text-base md:text-lg font-bold mb-2">フォーム管理</h3>
                        <p className="text-xs md:text-sm text-muted-foreground flex-1">
                          汎用フォームを作成し入力ページを管理
                        </p>
                        <div className="flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>開く</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {isAdmin && (
                  <Link href="/admin/feedback" className="group">
                    <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                      <div className="relative h-full flex flex-col">
                        <MessageSquare className="w-6 md:w-8 h-6 md:h-8 text-primary mb-3 md:mb-4" />
                        <h3 className="text-base md:text-lg font-bold mb-2">フィードバック</h3>
                        <p className="text-xs md:text-sm text-muted-foreground flex-1">
                          送信された意見を確認できます。
                        </p>
                        <div className="flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>開く</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
