"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { StagePlotDrumKit } from "@/components/StagePlotDrumKit";
import {
  STATIC_STAGE_MARKERS,
  splitStageItemLabel,
  type StageItemVariant,
} from "@/lib/stagePlot";

type StageItem = {
  id: string;
  label: string;
  dashed?: boolean;
  x: number;
  y: number;
  variant?: StageItemVariant;
  templateId?: import("@/lib/stagePlot").DefaultStageItemTemplateId;
};

type StageMember = {
  id: string;
  name: string;
  instrument?: string | null;
  x: number;
  y: number;
  isMc?: boolean;
};

const GRID_STEP = 2.5;
const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

function StagePlotItemContent({ label, variant }: { label: string; variant?: StageItemVariant }) {
  if (variant === "split-backline") {
    const parts = splitStageItemLabel(label);
    if (parts.length >= 2) {
      return (
        <div className="flex h-full w-full items-stretch">
          <span className="flex flex-1 items-center justify-center px-1 text-center leading-none">
            {parts[0]}
          </span>
          <span className="w-px bg-slate-500/80" />
          <span className="flex flex-1 items-center justify-center px-1 text-center leading-none">
            {parts.slice(1).join(" / ")}
          </span>
        </div>
      );
    }
  }

  return <span className="px-1 text-center leading-none">{label}</span>;
}

export function StagePlotPreview({
  items,
  members,
  className,
  compact = false,
}: {
  items: StageItem[];
  members: StageMember[];
  className?: string;
  compact?: boolean;
}) {
  const fixedItems = useMemo(() => {
    const next = [...STATIC_STAGE_MARKERS];
    const mcCount = members.filter((member) => member.isMc).length;
    if (mcCount > 0) {
      next.push({ id: "mc-area", label: "MC", x: 50, y: 75, kind: "monitor" as const });
    }
    return next;
  }, [members]);

  return (
    <div
      className={cn(
        "relative w-full border border-border/80 bg-zinc-900/95 overflow-hidden shadow-inner",
        compact ? "aspect-[2.35/1] rounded-lg xl:aspect-[2.6/1]" : "aspect-[2/1] rounded-xl",
        className
      )}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)",
          backgroundSize: `${GRID_STEP}% ${GRID_STEP}%`,
        }}
      />

      <div
        className={cn(
          "absolute rounded bg-zinc-900/70 font-semibold text-zinc-300 pointer-events-none select-none",
          compact ? "left-3 top-1.5 px-1.5 py-0.5 text-[10px]" : "left-4 top-2 px-2 py-0.5 text-xs"
        )}
      >
        舞台奥 (Stage Back)
      </div>
      <div
        className={cn(
          "absolute rounded bg-zinc-900/70 font-semibold text-zinc-300 pointer-events-none select-none",
          compact ? "bottom-1.5 left-3 px-1.5 py-0.5 text-[10px]" : "bottom-2 left-4 px-2 py-0.5 text-xs"
        )}
      >
        下手 (Shimote)
      </div>
      <div
        className={cn(
          "absolute rounded bg-zinc-900/70 font-semibold text-zinc-300 pointer-events-none select-none",
          compact ? "bottom-1.5 right-3 px-1.5 py-0.5 text-[10px]" : "bottom-2 right-4 px-2 py-0.5 text-xs"
        )}
      >
        上手 (Kamite)
      </div>
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 rounded bg-zinc-900/70 font-semibold text-zinc-300 pointer-events-none select-none",
          compact ? "bottom-1.5 px-1.5 py-0.5 text-[10px]" : "bottom-2 px-2 py-0.5 text-xs"
        )}
      >
        客席 (Audience)
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 top-[8%] w-[20%] h-[25%] opacity-50 pointer-events-none select-none"
        style={{ zIndex: 0 }}
      >
        <StagePlotDrumKit className="w-full h-full text-zinc-500" />
      </div>

      {fixedItems.map((item) => {
        const isMain = item.kind === "main";
        return (
          <div
            key={item.id}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center border select-none pointer-events-none shadow",
              isMain
                ? "bg-zinc-800/90 border-zinc-500 font-bold text-zinc-200 rounded-md"
                : "bg-zinc-700/80 border-zinc-500/80 font-semibold text-zinc-100 rounded-sm border-dashed",
              compact ? "px-1 text-[9px]" : "text-[11px]"
            )}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: compact ? (isMain ? "11.5%" : "7.5%") : isMain ? "13%" : "8.5%",
              height: compact ? "7%" : "8%",
            }}
          >
            <span className="px-1 text-center leading-none">{item.label}</span>
          </div>
        );
      })}

      {items.map((item) => {
        const isBackline = item.variant === "backline" || item.variant === "split-backline";
        return (
          <div
            key={item.id}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center shadow-sm z-10",
              isBackline
                ? "border border-slate-400 bg-slate-200/95 text-slate-900 font-semibold"
                : "rounded-full border border-muted-foreground/90 bg-background/95 text-muted-foreground font-semibold",
              item.dashed ? "border-dashed" : "border-solid",
              isBackline
                ? compact
                  ? "rounded px-1 text-[8px]"
                  : "rounded-md text-[9px]"
                : compact
                  ? "h-9 w-9 text-[9px]"
                  : "h-11 w-11 text-[11px]"
            )}
            title={item.label}
            style={{
              left: `${clampPercent(item.x)}%`,
              top: `${clampPercent(item.y)}%`,
              width: isBackline
                ? compact
                  ? item.variant === "split-backline"
                    ? "16%"
                    : "9%"
                  : item.variant === "split-backline"
                    ? "18%"
                    : "10%"
                : undefined,
              height: isBackline ? (compact ? "7%" : "8%") : undefined,
            }}
          >
            {isBackline ? (
              <StagePlotItemContent label={item.label} variant={item.variant} />
            ) : (
              <span
                className={cn(
                  "overflow-hidden text-ellipsis px-1 text-center leading-tight",
                  compact ? "max-w-[40px]" : "max-w-[52px]"
                )}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}

      {members.map((member) => (
        <div
          key={member.id}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center rounded-full border border-primary bg-background/95 text-foreground font-bold leading-none shadow-sm z-20",
            compact ? "h-9 w-9 text-[9px]" : "h-11 w-11 text-[10px]"
          )}
          title={`${member.instrument ?? "Part"} ${member.name}`}
          style={{
            left: `${clampPercent(member.x)}%`,
            top: `${clampPercent(member.y)}%`,
          }}
        >
          <span
            className={cn(
              "overflow-hidden text-ellipsis px-1 text-center leading-tight",
              compact ? "max-w-[38px]" : "max-w-[48px]"
            )}
          >
            {member.instrument ?? "Part"}
          </span>
          {!compact ? (
            <span className="max-w-[48px] overflow-hidden text-ellipsis px-1 text-center text-[8px] leading-tight text-muted-foreground">
              {member.name}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
