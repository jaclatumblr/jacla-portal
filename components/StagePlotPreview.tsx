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
        "relative w-full aspect-[2/1] rounded-lg border border-border bg-zinc-900 overflow-hidden",
        className
      )}
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)",
          backgroundSize: `${GRID_STEP}% ${GRID_STEP}%`,
        }}
      />

      <div className="absolute top-2 left-4 text-xs font-bold text-muted-foreground pointer-events-none select-none">
        舞台奥 (Stage Back)
      </div>
      <div className="absolute bottom-2 left-4 text-xs font-bold text-muted-foreground pointer-events-none select-none">
        下手 (Shimote)
      </div>
      <div className="absolute bottom-2 right-4 text-xs font-bold text-muted-foreground pointer-events-none select-none">
        上手 (Kamite)
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-bold text-muted-foreground pointer-events-none select-none">
        客席 (Audience)
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 top-[8%] w-[20%] h-[25%] opacity-40 pointer-events-none select-none"
        style={{ zIndex: 0 }}
      >
        <StagePlotDrumKit className="w-full h-full text-zinc-600" />
      </div>

      {fixedItems.map((item) => {
        const isMain = item.label.startsWith("MAIN");
        return (
          <div
            key={item.id}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[10px] font-bold text-zinc-400 bg-zinc-800 border border-zinc-600 rounded select-none pointer-events-none",
              !isMain && "border-dashed"
            )}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: isMain ? "12%" : "8%",
              height: isMain ? "8%" : "8%",
            }}
          >
            <span>{item.label}</span>
          </div>
        );
      })}

      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 flex h-12 w-12 flex-col items-center justify-center rounded-full border border-muted-foreground text-[10px] font-semibold leading-none bg-background text-muted-foreground shadow-sm z-10",
            item.dashed ? "border-dashed" : "border-solid"
          )}
          style={{
            left: `${clampPercent(item.x)}%`,
            top: `${clampPercent(item.y)}%`,
          }}
        >
          <span className="max-w-[44px] overflow-hidden text-ellipsis px-1 leading-none">
            {item.label}
          </span>
        </div>
      ))}

      {members.map((member) => (
        <div
          key={member.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex h-12 w-12 flex-col items-center justify-center rounded-full border border-primary bg-background text-foreground text-[10px] font-bold leading-none shadow-sm z-20"
          style={{
            left: `${clampPercent(member.x)}%`,
            top: `${clampPercent(member.y)}%`,
          }}
        >
          <span className="max-w-[44px] overflow-hidden text-ellipsis px-1 leading-none">
            {member.instrument ?? "Part"}
          </span>
          <span className="max-w-[44px] overflow-hidden text-ellipsis text-[8px] leading-none text-muted-foreground">
            {member.name}
          </span>
        </div>
      ))}
    </div>
  );
}
