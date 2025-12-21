import { Suspense } from "react";
import OnboardingClient from "@/app/onboarding/OnboardingClient";

export default function ProfileEditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-sm text-muted-foreground">読み込み中...</div>
        </div>
      }
    >
      <OnboardingClient mode="edit" defaultNext="/me/profile" />
    </Suspense>
  );
}
