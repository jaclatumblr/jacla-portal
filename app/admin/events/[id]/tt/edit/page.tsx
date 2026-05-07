"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "@/lib/icons";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useIsAdministrator } from "@/lib/useIsAdministrator";
import { useAdminEventData } from "../../hooks/useAdminEventData";
import { SlotManager } from "../../components/SlotManager";
import { statusBadge, statusLabel } from "../../types";

export default function AdminEventTimetableEditPage() {
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
    songs,
    slots,
    setSlots,
    refreshData,
  } = useAdminEventData(eventId, isAdmin, isAdministrator);

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
            <p className="mt-2 text-muted-foreground">
              {error ?? "イベントが見つかりません"}
            </p>
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
            title={`${event.name} TT編集`}
            description="共通のタイムテーブル編集ロジックを使用します。"
            backHref={`/admin/events/${eventId}`}
            backLabel="イベント詳細に戻る"
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
              <SlotManager
                event={event}
                bands={bands}
                members={members}
                songs={songs}
                slots={slots}
                setSlots={setSlots}
                onRefresh={refreshData}
              />
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
