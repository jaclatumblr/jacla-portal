"use client";

import { Shield, User } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { cn } from "@/lib/utils";

type AdministratorModeToggleProps = {
  compact?: boolean;
  className?: string;
  variant?: "secondary" | "ghost" | "outline";
};

export function AdministratorModeToggle({
  compact = false,
  className,
  variant = "secondary",
}: AdministratorModeToggleProps) {
  const { canToggleMode, loading, mode, toggleMode } = useAdminMode();

  if (!canToggleMode) return null;

  const nextMode = mode === "administrator" ? "general" : "administrator";
  const label = nextMode === "general" ? "Generalモードへ" : "Administratorモードへ";
  const Icon = nextMode === "general" ? User : Shield;

  return (
    <Button
      type="button"
      variant={variant}
      size={compact ? "icon" : "default"}
      onClick={toggleMode}
      aria-label={label}
      title={compact ? label : undefined}
      disabled={loading}
      className={cn(compact ? "h-10 w-10" : "w-full justify-start", className)}
    >
      <Icon className="h-4 w-4" />
      {!compact && <span>{label}</span>}
    </Button>
  );
}
