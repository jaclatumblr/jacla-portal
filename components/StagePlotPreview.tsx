"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

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

const fixedBaseItems: StageItem[] = [
  { id: "fixed-main-l", label: "MAIN L", dashed: true, x: 18, y: 84 },
  { id: "fixed-main-r", label: "MAIN R", dashed: true, x: 82, y: 84 },
  { id: "fixed-mon-1", label: "MON1", dashed: true, x: 12, y: 68 },
  { id: "fixed-mon-2", label: "MON2", dashed: true, x: 58, y: 22 },
  { id: "fixed-mon-3", label: "MON3", dashed: true, x: 50, y: 82 },
  { id: "fixed-mon-4", label: "MON4", dashed: true, x: 88, y: 68 },
];

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
    const next = [...fixedBaseItems];
    if (members.some((member) => member.isMc)) {
      next.push({ id: "fixed-mc", label: "MC", dashed: false, x: 50, y: 72 });
    }
    return next;
  }, [members]);

  return (
    <div
      className={cn(
        "relative w-full h-[220px] sm:h-[260px] rounded-lg border border-border bg-gradient-to-b from-muted/10 to-muted/30 overflow-hidden",
        className
      )}
    >
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
        STAGE
      </div>
      <div className="absolute top-2 left-3 text-[10px] text-muted-foreground">舞台奥</div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground bg-background/70 px-1 rounded">
        客席
      </div>
      <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground">下手</div>
      <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">上手</div>

      {fixedItems.map((item) => (
        <div
          key={item.id}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 border text-[12px] font-semibold shadow-sm bg-muted/60 text-muted-foreground pointer-events-none rounded-md px-2 py-1",
            item.dashed ? "border-dashed" : "border-solid"
          )}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
        >
          {item.label}
        </div>
      ))}

      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-[12px] font-semibold bg-card/80 text-foreground",
            item.dashed ? "border-dashed" : "border-solid"
          )}
          style={{
            left: `${clampPercent(item.x)}%`,
            top: `${clampPercent(item.y)}%`,
          }}
        >
          {item.label}
        </div>
      ))}

      {members.map((member) => (
        <div
          key={member.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-card px-2 py-1 text-[12px] font-semibold text-foreground shadow-sm"
          style={{
            left: `${clampPercent(member.x)}%`,
            top: `${clampPercent(member.y)}%`,
          }}
        >
          {member.instrument ?? "Part"}
          <div className="text-[11px] text-muted-foreground">{member.name}</div>
        </div>
      ))}
    </div>
  );
}
