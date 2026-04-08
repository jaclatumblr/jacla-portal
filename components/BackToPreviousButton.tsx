"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";

type BackToPreviousButtonProps = {
  fallbackHref?: string;
  label?: string;
};

export function BackToPreviousButton({
  fallbackHref = "/",
  label = "前のページに戻る",
}: BackToPreviousButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <Button type="button" variant="ghost" onClick={handleBack} className="gap-2 px-0">
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
