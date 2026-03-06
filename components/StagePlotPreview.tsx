"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { StagePlotDrumKit } from "@/components/StagePlotDrumKit";

type StageItem = {
  id: string;
  label: string;
  dashed?: boolean;
  x: number;
  y: number;
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

export function StagePlotPreview({
  items,
  members,
  className,
}: {
  items: StageItem[];
  members: StageMember[];
  className?: string;
}) {
  const fixedItems = useMemo(() => {
    const next: StageItem[] = [
      { id: "fixed-main-l", label: "MAIN L", dashed: true, x: 21, y: 81 },
      { id: "fixed-main-r", label: "MAIN R", dashed: true, x: 79, y: 81 },
      { id: "fixed-mon-1", label: "MON1", dashed: true, x: 14, y: 62 },
      { id: "fixed-mon-2", label: "MON2", dashed: true, x: 62, y: 13 },
      { id: "fixed-mon-3", label: "MON3", dashed: true, x: 50, y: 87 },
      { id: "fixed-mon-4", label: "MON4", dashed: true, x: 86, y: 62 },
    ];

    const mcCount = members.filter((member) => member.isMc).length;
    if (mcCount > 0) {
      next.push({ id: "fixed-mc", label: "MCエリア", dashed: false, x: 50, y: 75 });
    }
    return next;
  }, [members]);

  return (
    <div
      className={cn(
        "relative w-full aspect-[2/1] rounded-xl border border-border/80 bg-zinc-900/95 overflow-hidden shadow-inner",
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

      <div className="absolute top-2 left-4 rounded bg-zinc-900/70 px-2 py-0.5 text-xs font-semibold text-zinc-300 pointer-events-none select-none">
        舞台奥 (Stage Back)
      </div>
      <div className="absolute bottom-2 left-4 rounded bg-zinc-900/70 px-2 py-0.5 text-xs font-semibold text-zinc-300 pointer-events-none select-none">
        下手 (Shimote)
      </div>
      <div className="absolute bottom-2 right-4 rounded bg-zinc-900/70 px-2 py-0.5 text-xs font-semibold text-zinc-300 pointer-events-none select-none">
        上手 (Kamite)
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-zinc-900/70 px-2 py-0.5 text-xs font-semibold text-zinc-300 pointer-events-none select-none">
        客席 (Audience)
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 top-[8%] w-[20%] h-[25%] opacity-50 pointer-events-none select-none"
        style={{ zIndex: 0 }}
      >
        <StagePlotDrumKit className="w-full h-full text-zinc-500" />
      </div>

      {fixedItems.map((item) => {
        const isMain = item.label.startsWith("MAIN");
        return (
          <div
            key={item.id}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[11px] font-bold text-zinc-200 bg-zinc-800/90 border border-zinc-500 rounded-md select-none pointer-events-none shadow",
              !isMain && "border-dashed"
            )}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: isMain ? "13%" : "8.5%",
              height: isMain ? "8%" : "8%",
            }}
          >
            <span className="px-1 text-center leading-none">{item.label}</span>
          </div>
        );
      })}

      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 flex-col items-center justify-center rounded-full border border-muted-foreground/90 bg-background/95 text-[11px] font-semibold leading-none text-muted-foreground shadow-sm z-10",
            item.dashed ? "border-dashed" : "border-solid"
          )}
          style={{
            left: `${clampPercent(item.x)}%`,
            top: `${clampPercent(item.y)}%`,
          }}
        >
          <span className="max-w-[52px] overflow-hidden text-ellipsis px-1 text-center leading-tight">
            {item.label}
          </span>
        </div>
      ))}

      {members.map((member) => (
        <div
          key={member.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 flex-col items-center justify-center rounded-full border border-primary bg-background/95 text-foreground text-[10px] font-bold leading-none shadow-sm z-20"
          style={{
            left: `${clampPercent(member.x)}%`,
            top: `${clampPercent(member.y)}%`,
          }}
        >
          <span className="max-w-[48px] overflow-hidden text-ellipsis px-1 text-center leading-tight">
            {member.instrument ?? "Part"}
          </span>
          <span className="max-w-[48px] overflow-hidden text-ellipsis px-1 text-center text-[8px] leading-tight text-muted-foreground">
            {member.name}
          </span>
        </div>
      ))}
    </div>
  );
}
