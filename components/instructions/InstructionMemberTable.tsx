import { BandMemberDetail } from "@/app/types/instructions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { instructionTheme, InstructionRole } from "@/components/instructions/theme";

type InstructionMemberTableProps = {
  members: BandMemberDetail[];
  role: InstructionRole;
};

const hasText = (value: string | null | undefined) => Boolean(value?.trim());

export function InstructionMemberTable({
  members,
  role,
}: InstructionMemberTableProps) {
  if (members.length === 0) {
    return (
      <p className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
        メンバー情報は未入力です。
      </p>
    );
  }

  const theme = instructionTheme[role];
  const monitorRequestCount = members.filter(
    (member) => hasText(member.monitorRequest) || hasText(member.monitorNote)
  ).length;
  const mcCount = members.filter((member) => member.isMc).length;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-xl border px-3 py-2 text-xs",
          role === "pa"
            ? `${theme.accentBorder} ${theme.accentSurfaceStrong} ${theme.accentStrongText}`
            : `${theme.accentBorder} ${theme.accentSurfaceStrong} ${theme.accentStrongText}`
        )}
      >
        {role === "pa"
          ? `返し要望あり ${monitorRequestCount} / ${members.length} 人`
          : `MCあり ${mcCount} / ${members.length} 人`}
      </div>

      <div className="space-y-2 md:hidden">
        {members.map((member) => {
          const hasMonitorNote = hasText(member.monitorRequest) || hasText(member.monitorNote);

          return (
            <div
              key={member.id}
              className={cn(
                "rounded-xl border bg-card/70 p-3 text-sm shadow-sm",
                role === "pa" && hasMonitorNote
                  ? `${theme.accentBorder} ${theme.accentSurface}`
                  : "border-border/70"
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">{member.instrument || "Part"}</span>
                  {member.isMc ? (
                    <Badge
                      variant="outline"
                      className={cn("h-5 text-[10px]", theme.chip)}
                    >
                      MC
                    </Badge>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">{member.name}</span>
              </div>

              {role === "pa" ? (
                <div className="grid gap-2 border-t border-border/50 pt-3 text-xs">
                  <div className="grid grid-cols-[64px,1fr] gap-2">
                    <span className="text-muted-foreground">返し要望</span>
                    <span className="whitespace-pre-wrap font-medium text-foreground">
                      {member.monitorRequest?.trim() || "-"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[64px,1fr] gap-2">
                    <span className="text-muted-foreground">備考</span>
                    <span className="whitespace-pre-wrap text-foreground">
                      {member.monitorNote?.trim() || "-"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 border-t border-border/50 pt-3 text-xs">
                  <div className="grid grid-cols-[64px,1fr] gap-2">
                    <span className="text-muted-foreground">演者名</span>
                    <span className="text-foreground">{member.name}</span>
                  </div>
                  <div className="grid grid-cols-[64px,1fr] gap-2">
                    <span className="text-muted-foreground">照明視点</span>
                    <span className="text-foreground">
                      {member.isMc ? "MC導線あり" : "通常パート"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden rounded-xl border border-border/70 bg-card/50 md:block">
        <div
          className={cn(
            "grid gap-3 border-b border-border/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
            role === "pa"
              ? "grid-cols-[88px_minmax(0,140px)_40px_minmax(0,1fr)_minmax(0,1fr)]"
              : "grid-cols-[88px_minmax(0,1fr)_40px_108px]"
          )}
        >
          <span>パート</span>
          <span>名前</span>
          <span className="text-center">MC</span>
          {role === "pa" ? (
            <>
              <span className={theme.accentText}>返し要望</span>
              <span className={theme.accentText}>備考</span>
            </>
          ) : (
            <span className={theme.accentText}>照明視点</span>
          )}
        </div>

        <div className="divide-y divide-border/60">
          {members.map((member) => {
            const hasMonitorNote = hasText(member.monitorRequest) || hasText(member.monitorNote);

            return (
              <div
                key={member.id}
                className={cn(
                  "px-3 py-2.5",
                  role === "pa" && hasMonitorNote
                    ? theme.accentSurface
                    : role === "lighting" && member.isMc
                      ? theme.accentSurface
                      : "bg-card/30"
                )}
              >
                <div
                  className={cn(
                    "grid gap-3",
                    role === "pa"
                      ? "grid-cols-[88px_minmax(0,140px)_40px_minmax(0,1fr)_minmax(0,1fr)]"
                      : "grid-cols-[88px_minmax(0,1fr)_40px_108px]"
                  )}
                >
                  <div className="text-sm font-semibold text-foreground">
                    {member.instrument || "Part"}
                  </div>
                  <div className="min-w-0 text-sm text-foreground">{member.name}</div>
                  <div className="flex items-start justify-center">
                    {member.isMc ? (
                      <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", theme.chip)}>
                        MC
                      </Badge>
                    ) : (
                      <span className="pt-0.5 text-xs text-muted-foreground">-</span>
                    )}
                  </div>

                  {role === "pa" ? (
                    <>
                      <div className="whitespace-pre-wrap break-words text-sm text-foreground">
                        {member.monitorRequest?.trim() || "-"}
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {member.monitorNote?.trim() || "-"}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-foreground">
                      {member.isMc ? "MC導線あり" : "通常"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
