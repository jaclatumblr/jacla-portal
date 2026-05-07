"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminEventStaffPage() {
  const params = useParams();
  const eventId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const { canAccessAdmin, loading } = useRoleFlags();

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-background">
          <SideNav />
          <main className="flex-1 md:ml-20">
            <PageHeader
              kicker="Shift"
              title="シフト作成"
              description="読み込み中..."
              backHref={`/admin/events/${eventId}`}
              backLabel="イベント編集"
            />
          </main>
        </div>
      </AuthGuard>
    );
  }

  if (!canAccessAdmin) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-background">
          <SideNav />
          <main className="flex-1 md:ml-20">
            <PageHeader
              kicker="Shift"
              title="シフト作成"
              description="このページを閲覧する権限がありません。"
              backHref={`/admin/events/${eventId}`}
              backLabel="イベント編集"
            />
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
            kicker="Shift"
            title="シフト作成"
            description="PA と照明のシフトは専用ページで、バンド単位かつリハ/本番共通の担当として管理します。"
            backHref={`/admin/events/${eventId}`}
            backLabel="イベント編集"
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">シフト作成ページ</CardTitle>
                  <CardDescription>
                    PA と照明でページを分けて管理します。各バンドの通常リハ、直前リハ、本番をまとめて編集できます。
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/events/${eventId}/shift`}
                    className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
                  >
                    シフト作成
                  </Link>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
