"use client";

import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { ProfileForm } from "@/app/onboarding/components/ProfileForm";
import { useAccountDeletion } from "@/app/onboarding/hooks/useAccountDeletion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const checklistItems = [
  "表示名と本名",
  "学籍番号と入学年度",
  "連絡先（電話番号）",
  "メインパートとサブパート",
  "Discord 連携状態（任意）",
];

type ProfileEditClientProps = {
  requiredParam?: string | null;
};

export default function ProfileEditClient({ requiredParam }: ProfileEditClientProps) {
  const { deleting, handleDeleteAccount } = useAccountDeletion();
  const showPhoneRequiredMessage = requiredParam === "phone";

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Profile"
            title="プロフィール編集"
            description="プロフィール情報と連携サービスを更新できます。"
            backHref="/me/profile"
            backLabel="プロフィールへ戻る"
            tone="secondary"
          />

          <section className="pb-10 md:pb-14">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                  <Card className="border-border/80 bg-card/70">
                    <CardHeader className="space-y-3">
                      <Badge variant="outline" className="w-fit text-[11px]">
                        編集ガイド
                      </Badge>
                      <CardTitle className="text-base">保存前チェック</CardTitle>
                      <CardDescription>
                        送信前に必須項目を確認してください。
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {checklistItems.map((item) => (
                        <div
                          key={item}
                          className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-destructive/40 bg-destructive/5">
                    <CardHeader className="space-y-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                        危険操作
                      </CardTitle>
                      <CardDescription className="text-xs">
                        アカウントを削除するとプロフィール情報は元に戻せません。
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                        className="w-full"
                      >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        アカウントを削除
                      </Button>
                    </CardContent>
                  </Card>
                </aside>

                <Card className="border-border bg-card/70 shadow-sm">
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">編集中</Badge>
                      <Badge variant="outline">プロフィール</Badge>
                    </div>
                    <CardTitle className="text-xl">公開プロフィール情報を編集</CardTitle>
                    <CardDescription className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      一部項目はメンバー一覧、シフト、イベント運用で参照されます。
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {showPhoneRequiredMessage && (
                      <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        連絡先（電話番号）が未入力です。入力して保存してください。
                      </div>
                    )}
                    <ProfileForm isEdit nextUrl="/me/profile/edit" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
