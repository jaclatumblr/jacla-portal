import { SongRow } from "@/app/types/instructions";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Link as LinkIcon, Lightbulb, Music } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { instructionTheme, InstructionRole } from "@/components/instructions/theme";

type InstructionSetlistTableProps = {
  songs: SongRow[];
  role: InstructionRole;
};

const formatDuration = (durationSec: number | null) => {
  if (durationSec == null) return "-";
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatLightingChoice = (value: string | null) => {
  if (!value) return "-";
  if (value === "o") return "あり";
  if (value === "x") return "なし";
  if (value === "auto") return "おまかせ";
  return value;
};

const hasLightingCue = (song: SongRow) =>
  Boolean(
    song.lighting_spot || song.lighting_strobe || song.lighting_moving || song.lighting_color
  );

function LightingCueBadge({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const text = formatLightingChoice(value);
  const active = value === "o";
  const auto = value === "auto";

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 border text-[10px]",
        active
          ? "border-amber-300/40 bg-amber-500/10 text-amber-700 dark:text-amber-100"
          : auto
            ? "border-amber-300/30 bg-amber-500/5 text-amber-700 dark:text-amber-200"
            : "border-border/60 bg-background/60 text-muted-foreground"
      )}
    >
      {label}: {text}
    </Badge>
  );
}

export function InstructionSetlistTable({
  songs,
  role,
}: InstructionSetlistTableProps) {
  if (songs.length === 0) {
    return (
      <p className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
        セットリストは未入力です。
      </p>
    );
  }

  const theme = instructionTheme[role];
  const songEntries = songs.filter((song) => song.entry_type !== "mc");
  const mcEntries = songs.length - songEntries.length;
  const paMemoCount = songs.filter((song) => Boolean(song.memo?.trim())).length;
  const lightingCueCount = songEntries.filter(hasLightingCue).length;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-xl border px-3 py-2 text-xs",
          theme.accentBorder,
          theme.accentSurfaceStrong,
          theme.accentStrongText
        )}
      >
        {role === "pa"
          ? `楽曲 ${songEntries.length} 曲 / MC ${mcEntries} 件 / PAメモ ${paMemoCount} 件`
          : `楽曲 ${songEntries.length} 曲 / MC ${mcEntries} 件 / 照明キュー入力 ${lightingCueCount} 曲`}
      </div>

      <div className="space-y-2 md:hidden">
        {songs.map((song, index) => {
          const isSong = song.entry_type !== "mc";
          const title = song.title?.trim()
            ? song.title
            : song.entry_type === "mc"
              ? "MC"
              : "-";
          const artist = isSong ? song.artist?.trim() : null;

          return (
            <article
              key={song.id}
              className={cn(
                "rounded-xl border bg-card/70 p-3 shadow-sm",
                role === "lighting" && hasLightingCue(song)
                  ? `${theme.accentBorder} ${theme.accentSurface}`
                  : "border-border/70"
              )}
            >
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">#{String(index + 1).padStart(2, "0")}</span>
                <span className="font-mono">{formatDuration(song.duration_sec)}</span>
              </div>

              <div className="mb-3 flex items-start gap-2">
                {song.entry_type === "mc" ? (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    MC
                  </Badge>
                ) : role === "pa" ? (
                  <Music className="mt-0.5 h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
                ) : (
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight text-foreground">
                    {title}
                  </div>
                  {artist ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">{artist}</div>
                  ) : null}
                </div>
              </div>

              {song.url ? (
                <a
                  href={song.url}
                  className="mb-3 ml-5 flex items-center gap-1 break-all text-xs text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                  参考URL
                </a>
              ) : null}

              <div className="grid gap-2 border-t border-border/50 pt-3 text-xs">
                <div className="grid grid-cols-[84px,1fr] gap-2">
                  <span className="text-muted-foreground">アレンジ/備考</span>
                  <span className="whitespace-pre-wrap text-foreground">
                    {isSong ? song.arrangement_note || "-" : "-"}
                  </span>
                </div>

                {role === "pa" ? (
                  <div className="grid grid-cols-[84px,1fr] gap-2">
                    <span className="font-semibold text-blue-700 dark:text-blue-300">PAメモ</span>
                    <span className="whitespace-pre-wrap font-medium text-foreground">
                      {song.memo || "-"}
                    </span>
                  </div>
                ) : isSong ? (
                  <>
                    <div className="grid grid-cols-[84px,1fr] gap-2">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        照明キュー
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <LightingCueBadge label="Spot" value={song.lighting_spot} />
                        <LightingCueBadge label="Strobe" value={song.lighting_strobe} />
                        <LightingCueBadge label="Moving" value={song.lighting_moving} />
                      </div>
                    </div>
                    <div className="grid grid-cols-[84px,1fr] gap-2">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        色イメージ
                      </span>
                      <span className="whitespace-pre-wrap text-foreground">
                        {song.lighting_color || "-"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-[84px,1fr] gap-2">
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      照明視点
                    </span>
                    <span className="text-foreground">MC導線と転換を確認</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden rounded-xl border border-border/70 bg-card/50 md:block">
        <div
          className={cn(
            "grid gap-3 border-b border-border/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
            role === "pa"
              ? "grid-cols-[40px_minmax(0,1.4fr)_72px_minmax(0,1fr)]"
              : "grid-cols-[40px_minmax(0,1.25fr)_72px_minmax(0,1.05fr)]"
          )}
        >
          <span>#</span>
          <span>曲 / メモ</span>
          <span>時間</span>
          <span className={theme.accentText}>{role === "pa" ? "PAメモ" : "照明キュー"}</span>
        </div>

        <div className="divide-y divide-border/60">
          {songs.map((song, index) => {
            const isSong = song.entry_type !== "mc";
            const title = song.title?.trim() || (song.entry_type === "mc" ? "MC" : "-");

            return (
              <div
                key={song.id}
                className={cn(
                  "px-3 py-2.5",
                  role === "pa" && song.memo?.trim()
                    ? theme.accentSurface
                    : role === "lighting" && hasLightingCue(song)
                      ? theme.accentSurface
                      : "bg-card/30"
                )}
              >
                <div
                  className={cn(
                    "grid gap-3",
                    role === "pa"
                      ? "grid-cols-[40px_minmax(0,1.4fr)_72px_minmax(0,1fr)]"
                      : "grid-cols-[40px_minmax(0,1.25fr)_72px_minmax(0,1.05fr)]"
                  )}
                >
                  <div className="pt-0.5 font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {song.entry_type === "mc" ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          MC
                        </Badge>
                      ) : role === "pa" ? (
                        <Music className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
                      ) : (
                        <Lightbulb className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {title}
                      </span>
                    </div>

                    {isSong && song.artist ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">{song.artist}</div>
                    ) : null}

                    {song.arrangement_note?.trim() ? (
                      <div className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {song.arrangement_note}
                      </div>
                    ) : null}

                    {song.url ? (
                      <a
                        href={song.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline"
                      >
                        <LinkIcon className="h-3 w-3" />
                        URL
                      </a>
                    ) : null}
                  </div>

                  <div className="pt-0.5 font-mono text-xs text-muted-foreground">
                    {formatDuration(song.duration_sec)}
                  </div>

                  {role === "pa" ? (
                    <div className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {song.memo?.trim() || <span className="text-muted-foreground">-</span>}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {isSong ? (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            <LightingCueBadge label="Spot" value={song.lighting_spot} />
                            <LightingCueBadge label="Strobe" value={song.lighting_strobe} />
                            <LightingCueBadge label="Moving" value={song.lighting_moving} />
                          </div>
                          <div className="whitespace-pre-wrap break-words text-xs text-foreground">
                            {song.lighting_color?.trim() || "-"}
                          </div>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">MC導線を確認</span>
                      )}
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
