import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { BandNoteRow } from "@/app/types/instructions";
import { cn } from "@/lib/utils";

type InstructionCardProps = {
  band: BandNoteRow;
  channelCount?: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  role: "pa" | "lighting";
};

const statusLabel = (status: string | null) =>
  status === "submitted" ? "提出済み" : "下書き";

export function InstructionCard({
  band,
  channelCount,
  isExpanded,
  onToggle,
  children,
  role,
}: InstructionCardProps) {
  const panelId = `instruction-band-${band.id}`;

  const roleColorClass =
    role === "pa"
      ? "bg-blue-500/5 hover:bg-blue-500/10 border-blue-200/20"
      : "bg-purple-500/5 hover:bg-purple-500/10 border-purple-200/20";

  return (
    <div className={cn("rounded-lg border border-border p-0 overflow-hidden", roleColorClass)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="w-full text-left p-4 flex flex-col gap-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold flex items-center gap-2">{band.name}</h3>
            {role === "pa" && channelCount !== undefined && (
              <span className="text-xs font-mono bg-background/50 px-1.5 py-0.5 rounded border border-border">
                {channelCount} CH
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={band.repertoire_status === "submitted" ? "default" : "secondary"}
              className="text-[10px] h-5"
            >
              {statusLabel(band.repertoire_status)}
            </Badge>
            <ChevronDown
              className={cn(
                "w-5 h-5 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div
          id={panelId}
          className="px-4 pb-4 pt-0 border-t border-border/10 animate-in slide-in-from-top-2 fade-in duration-200"
        >
          <div className="mt-4 space-y-4">{children}</div>
        </div>
      )}
    </div>
  );
}
