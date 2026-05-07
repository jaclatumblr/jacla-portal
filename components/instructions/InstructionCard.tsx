import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "@/lib/icons";
import { BandNoteRow } from "@/app/types/instructions";
import { cn } from "@/lib/utils";
import { InstructionMetric } from "@/components/instructions/InstructionMetric";
import { instructionTheme, InstructionRole } from "@/components/instructions/theme";

type InstructionSummaryItem = {
  label: string;
  value: string;
  tone?: "accent" | "muted";
};

type InstructionCardProps = {
  band: BandNoteRow;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  role: InstructionRole;
  summaryItems?: InstructionSummaryItem[];
  preview?: string | null;
  secondaryPreview?: string | null;
};

const statusLabel = (status: string | null) =>
  status === "submitted" ? "提出済み" : "下書き";

export function InstructionCard({
  band,
  isExpanded,
  onToggle,
  children,
  role,
  summaryItems = [],
  preview,
  secondaryPreview,
}: InstructionCardProps) {
  const panelId = `instruction-band-${band.id}`;
  const theme = instructionTheme[role];
  const operatorLabel = role === "pa" ? "PA卓向け" : "照明卓向け";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card/70 shadow-sm ring-1",
        theme.accentBorder,
        theme.accentRing
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="w-full text-left"
      >
        <div className="space-y-4 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("h-6 border text-[10px] tracking-[0.18em]", theme.chip)}
                >
                  {operatorLabel}
                </Badge>
                <Badge
                  variant={band.repertoire_status === "submitted" ? "default" : "secondary"}
                  className="h-6 text-[10px]"
                >
                  {statusLabel(band.repertoire_status)}
                </Badge>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground md:text-xl">{band.name}</h3>
                {preview ? (
                  <p className={cn("text-sm font-medium leading-relaxed", theme.accentSoftText)}>
                    {preview}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    重要メモが未入力です。詳細を開いて確認してください。
                  </p>
                )}
                {secondaryPreview ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {secondaryPreview}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3 self-start">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {isExpanded ? "閉じる" : "詳細を見る"}
              </span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-180"
                )}
              />
            </div>
          </div>

          {summaryItems.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {summaryItems.map((item) => (
                <InstructionMetric
                  key={`${band.id}-${item.label}`}
                  label={item.label}
                  value={item.value}
                  role={role}
                  tone={item.tone ?? "accent"}
                />
              ))}
            </div>
          ) : null}
        </div>
      </button>

      {isExpanded ? (
        <div
          id={panelId}
          className="border-t border-border/60 px-4 pb-4 pt-4 md:px-5 md:pb-5 animate-in slide-in-from-top-2 fade-in duration-200"
        >
          <div className="space-y-4">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
