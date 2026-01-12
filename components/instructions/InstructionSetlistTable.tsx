import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { SongRow } from "@/app/types/instructions";
import { Badge } from "@/components/ui/badge";
import { Music, Lightbulb, Link as LinkIcon, ExternalLink } from "lucide-react";

type InstructionSetlistTableProps = {
    songs: SongRow[];
    role: "pa" | "lighting";
};

const formatDuration = (durationSec: number | null) => {
    if (durationSec == null) return "-";
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatLightingChoice = (value: string | null) => {
    if (!value) return "-";
    if (value === "o") return "○";
    if (value === "x") return "×";
    if (value === "auto") return "おまかせ";
    return value;
};

export function InstructionSetlistTable({
    songs,
    role,
}: InstructionSetlistTableProps) {
    if (songs.length === 0) {
        return (
            <p className="text-sm text-muted-foreground p-3 border rounded-md border-border/50 bg-muted/20">
                セットリストは未入力です。
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {/* Mobile / Card View */}
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
                        <div
                            key={song.id}
                            className="rounded-md border border-border bg-card/50 p-3"
                        >
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span className="font-mono">
                                    #{String(index + 1).padStart(2, "0")}
                                </span>
                                <span className="font-mono">
                                    {formatDuration(song.duration_sec)}
                                </span>
                            </div>
                            <div className="flex items-start gap-2 mb-2">
                                {song.entry_type === "mc" ? (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                        MC
                                    </Badge>
                                ) : (
                                    <Music className="w-3 h-3 mt-0.5 text-muted-foreground" />
                                )}
                                <div className="text-sm font-semibold leading-tight">
                                    {artist ? (
                                        <>
                                            <span>{title}</span>
                                            <span className="text-muted-foreground text-xs block mt-0.5">
                                                {artist}
                                            </span>
                                        </>
                                    ) : (
                                        title
                                    )}
                                </div>
                            </div>

                            {song.url && (
                                <a
                                    href={song.url}
                                    className="flex items-center gap-1 text-xs text-primary hover:underline break-all mb-2 ml-5"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    参考URL
                                </a>
                            )}

                            <div className="grid gap-2 text-xs border-t border-border/50 pt-2">
                                {/* 共通項目: アレンジ */}
                                <div className="grid grid-cols-[80px,1fr] gap-2">
                                    <span className="text-muted-foreground">アレンジ/備考</span>
                                    <span className="whitespace-pre-wrap">
                                        {isSong ? song.arrangement_note || "-" : "-"}
                                    </span>
                                </div>

                                {role === "pa" && (
                                    <div className="grid grid-cols-[80px,1fr] gap-2">
                                        <span className="text-blue-400 font-semibold">PAメモ</span>
                                        <span className="whitespace-pre-wrap text-foreground font-medium">
                                            {song.memo || "-"}
                                        </span>
                                    </div>
                                )}

                                {role === "lighting" && isSong && (
                                    <>
                                        <div className="grid grid-cols-[80px,1fr] gap-2">
                                            <span className="text-purple-400 font-semibold">照明</span>
                                            <div className="space-y-1">
                                                <div>
                                                    <span className="text-muted-foreground mr-1">
                                                        スポット:
                                                    </span>
                                                    {formatLightingChoice(song.lighting_spot)}
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground mr-1">
                                                        ストロボ:
                                                    </span>
                                                    {formatLightingChoice(song.lighting_strobe)}
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground mr-1">
                                                        ムービング:
                                                    </span>
                                                    {formatLightingChoice(song.lighting_moving)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-[80px,1fr] gap-2">
                                            <span className="text-purple-400 font-semibold">色イメージ</span>
                                            <span className="whitespace-pre-wrap">
                                                {song.lighting_color || "-"}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop / Table View */}
            <div className="hidden md:block overflow-x-auto rounded-md border border-border bg-card/40">
                <Table className="min-w-[900px]">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead className="min-w-[200px]">タイトル / アーティスト</TableHead>
                            <TableHead className="w-[80px]">時間</TableHead>
                            <TableHead className="w-[200px]">アレンジ/備考</TableHead>
                            {role === "pa" && (
                                <TableHead className="w-[250px] text-blue-400">PAメモ</TableHead>
                            )}
                            {role === "lighting" && (
                                <>
                                    <TableHead className="w-[200px] text-purple-400">
                                        照明指定
                                    </TableHead>
                                    <TableHead className="w-[150px] text-purple-400">
                                        色イメージ
                                    </TableHead>
                                </>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {songs.map((song, index) => {
                            const isSong = song.entry_type !== "mc";
                            return (
                                <TableRow key={song.id} className="hover:bg-muted/30">
                                    <TableCell className="font-mono text-muted-foreground">
                                        {String(index + 1).padStart(2, "0")}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                {song.entry_type === "mc" && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] px-1 py-0 h-4"
                                                    >
                                                        MC
                                                    </Badge>
                                                )}
                                                <span className="font-medium">
                                                    {song.title?.trim() || (song.entry_type === "mc" ? "MC" : "-")}
                                                </span>
                                            </div>
                                            {isSong && song.artist && (
                                                <span className="text-xs text-muted-foreground">
                                                    {song.artist}
                                                </span>
                                            )}
                                            {song.url && (
                                                <a
                                                    href={song.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-primary underline flex items-center gap-1 mt-0.5"
                                                >
                                                    <LinkIcon className="w-3 h-3" /> URL
                                                </a>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {formatDuration(song.duration_sec)}
                                    </TableCell>
                                    <TableCell className="text-sm whitespace-pre-wrap">
                                        {isSong ? song.arrangement_note || "-" : "-"}
                                    </TableCell>

                                    {/* PA Columns */}
                                    {role === "pa" && (
                                        <TableCell className="text-sm whitespace-pre-wrap font-medium">
                                            {song.memo || <span className="text-muted-foreground">-</span>}
                                        </TableCell>
                                    )}

                                    {/* Lighting Columns */}
                                    {role === "lighting" && (
                                        <>
                                            <TableCell className="text-xs">
                                                {isSong ? (
                                                    <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
                                                        <span className="text-muted-foreground">Spot:</span>
                                                        <span>{formatLightingChoice(song.lighting_spot)}</span>
                                                        <span className="text-muted-foreground">Str:</span>
                                                        <span>{formatLightingChoice(song.lighting_strobe)}</span>
                                                        <span className="text-muted-foreground">Mov:</span>
                                                        <span>
                                                            {formatLightingChoice(song.lighting_moving)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-pre-wrap">
                                                {isSong ? song.lighting_color || "-" : "-"}
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
