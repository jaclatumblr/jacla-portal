"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAccountDeletion } from "./hooks/useAccountDeletion";
import { ProfileForm } from "./components/ProfileForm";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const isEdit = searchParams.get("mode") === "edit";
  const { deleting, handleDeleteAccount } = useAccountDeletion();

  // Redirect destination after completion
  const nextTarget = searchParams.get("next") || "/";

  return (
    <div className="w-full max-w-4xl space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          {isEdit ? "Profile Settings" : "Welcome into Jacla"}
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {isEdit
            ? "登録情報を変更できます。所属班の変更は管理者の承認が必要な場合があります。"
            : "まずはプロフィールを作成しましょう。これらの情報は後からいつでも変更できます。"
          }
        </p>
      </div>

      {/* Main Form Card */}
      <div className="bg-card border border-border rounded-xl shadow-lg p-6 sm:p-10">
        <ProfileForm isEdit={isEdit} nextUrl={nextTarget} />
      </div>

      {/* Footer Actions (Delete Account) */}
      {isEdit && (
        <div className="flex justify-center pt-8">
          <Button
            variant="link"
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive transition-colors text-sm"
          >
            {deleting ? (
              <Loader2 className="w-3 h-3 animate-spin mr-2" />
            ) : null}
            アカウントを削除する
          </Button>
        </div>
      )}
    </div>
  );
}

export default function OnboardingClient() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-8">
      <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-primary" />}>
        <OnboardingContent />
      </Suspense>
    </div>
  );
}
