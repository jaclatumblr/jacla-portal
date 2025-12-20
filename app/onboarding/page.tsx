import { Suspense } from "react";
import OnboardingClient from "./OnboardingClient";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-sm text-muted-foreground">読み込み中...</div>
        </div>
      }
    >
      <OnboardingClient />
    </Suspense>
  );
}
