import { StagePlotPreview } from "@/components/StagePlotPreview";
import { StageItem, StageMember } from "@/app/types/instructions";

type InstructionStagePlotProps = {
  items: StageItem[];
  members: StageMember[];
};

export function InstructionStagePlot({ items, members }: InstructionStagePlotProps) {
  const hasContent = items.length > 0 || members.length > 0;

  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground p-3 border rounded-md border-border/50 bg-muted/20">
        立ち位置は未入力です。
      </p>
    );
  }

  return (
    <div className="mt-2">
      <StagePlotPreview items={items} members={members} />
      <p className="text-[10px] text-muted-foreground mt-1 text-right">
        ※ 実際の縮尺とは異なる場合があります。
      </p>
    </div>
  );
}
