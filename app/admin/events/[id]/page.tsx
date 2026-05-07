"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "@/lib/icons";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useIsAdministrator } from "@/lib/useIsAdministrator";
import { useAdminEventData } from "./hooks/useAdminEventData";
import { EventEditForm } from "./components/EventEditForm";
import { TimetableWithRepertoire } from "./components/TimetableWithRepertoire";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { statusBadge, statusLabel } from "./types";

export default function AdminEventDetailPage() {
  const params = useParams();
  const eventId = typeof params?.id === "string" ? params.id : "";
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isAdministrator } = useIsAdministrator();

  const {
    loading,
    error,
    event,
    bands,
    members,
    slots,
    songs,
    refreshData,
    setSlots,
  } = useAdminEventData(eventId, isAdmin, isAdministrator);
  const [activeTab, setActiveTab] = useState("basic");

  if (adminLoading || (!event && loading && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-muted-foreground">アクセス権限がありません。</p>
        </div>
      </AuthGuard>
    );
  }

  if (error || !event) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-background">
          <SideNav />
          <main className="flex-1 p-8">
            <h1 className="text-xl font-bold text-destructive">エラー</h1>
            <p className="mt-2 text-muted-foreground">{error ?? "イベントが見つかりません"}</p>
          </main>
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
            kicker="Admin Console"
            title={event.name}
            description="イベントの詳細設定、タイムテーブル管理、スタッフ配置を行います。"
            backHref="/admin"
            backLabel="管理画面に戻る"
            actions={
              <Badge
                variant={statusBadge(event.status) as "default" | "secondary" | "outline"}
                className="px-3 py-1 text-sm"
              >
                {statusLabel(event.status)}
              </Badge>
            }
          />

          <section className="py-8">
            <div className="container mx-auto max-w-7xl px-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                  <TabsTrigger value="basic">基本情報</TabsTrigger>
                  <TabsTrigger value="timetable">TT・レパ表</TabsTrigger>
                  <TabsTrigger value="staff">シフト作成</TabsTrigger>
                </TabsList>

                <TabsContent value="basic">
                  <EventEditForm event={event} onRefresh={refreshData} />
                </TabsContent>

                <TabsContent value="timetable">
                  <TimetableWithRepertoire
                    event={event}
                    eventId={eventId}
                    bands={bands}
                    members={members}
                    songs={songs}
                    slots={slots}
                    setSlots={setSlots}
                    onRefresh={refreshData}
                  />
                </TabsContent>

                <TabsContent value="staff">
                  <Card className="bg-card/60 border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">シフト作成ページ</CardTitle>
                      <CardDescription>
                        PA と照明は専用ページで管理します。現在の仕様では、バンド単位でリハと本番を同じ担当に揃えて編集します。
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/events/${eventId}/shift`}
                        className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary/60 hover:text-primary"
                      >
                        シフト作成
                      </Link>
                      <Link
                        href={`/admin/events/${eventId}/tt/staff`}
                        className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                      >
                        導線ページを見る
                      </Link>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
