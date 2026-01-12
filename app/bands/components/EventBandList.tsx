"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { toast } from "@/lib/toast";
import { formatDate } from "../types";
import type { EventBandSummary, EventRow, ProfileRow } from "../types";

type EventBandListProps = {
    events: EventRow[];
    selectedEventId: string;
    onEventChange: (id: string) => void;
    bands: EventBandSummary[];
    eventName: string | null;
    eventDate: string | null;
    selfPart: string;
    subPartsByProfileId: Record<string, string[]>;
    getFilteredProfiles: (existingUserIds: string[], query: string) => ProfileRow[];
    onRefresh: () => Promise<void>;
};

export function EventBandList({
    events,
    selectedEventId,
    onEventChange,
    bands,
    eventName,
    eventDate,
    selfPart,
    subPartsByProfileId,
    getFilteredProfiles,
    onRefresh,
}: EventBandListProps) {
    const { session } = useAuth();
    const { isAdmin } = useRoleFlags();
    const userId = session?.user.id ?? null;

    const [joinInstruments, setJoinInstruments] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        bands.forEach((band) => {
            initial[band.id] = selfPart;
        });
        return initial;
    });

    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
    const [activeBand, setActiveBand] = useState<EventBandSummary | null>(null);
    const [memberSearch, setMemberSearch] = useState("");
    const [selectedProfileId, setSelectedProfileId] = useState("");
    const [memberInstrument, setMemberInstrument] = useState("");
    const [existingUserIds, setExistingUserIds] = useState<string[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    const filteredProfiles = useMemo(() => {
        if (!activeBand) return [];
        return getFilteredProfiles(existingUserIds, memberSearch);
    }, [activeBand, existingUserIds, memberSearch, getFilteredProfiles]);

    const handleJoin = async (bandId: string) => {
        if (!userId) return;
        const instrument = joinInstruments[bandId]?.trim() ?? "";
        if (!instrument) {
            toast.error("担当パートを入力してください。");
            return;
        }

        const { error } = await supabase.from("band_members").insert({
            band_id: bandId,
            user_id: userId,
            instrument,
        });

        if (error) {
            console.error(error);
            toast.error("参加登録に失敗しました。");
            return;
        }

        toast.success("バンドに参加しました。");
        await onRefresh();
    };

    const handleDelete = async (band: EventBandSummary) => {
        if (!userId) return;
        const canDelete = band.created_by === userId || isAdmin;
        if (!canDelete) {
            toast.error("削除権限がありません。");
            return;
        }

        const confirmed = window.confirm(`「${band.name}」を削除します。よろしいですか？`);
        if (!confirmed) return;

        const { error } = await supabase.from("bands").delete().eq("id", band.id);
        if (error) {
            console.error(error);
            toast.error("バンドの削除に失敗しました。");
            return;
        }

        toast.success("バンドを削除しました。");
        await onRefresh();
    };

    const openMemberDialog = async (band: EventBandSummary) => {
        setActiveBand(band);
        setIsMemberDialogOpen(true);
        setMemberSearch("");
        setSelectedProfileId("");
        setMemberInstrument("");
        setExistingUserIds([]);
        setLoadingMembers(true);

        const { data, error } = await supabase
            .from("band_members")
            .select("user_id")
            .eq("band_id", band.id);

        if (error) {
            console.error(error);
            toast.error("メンバーの取得に失敗しました。");
            setExistingUserIds([]);
        } else {
            const ids = (data ?? [])
                .map((row) => (row as { user_id?: string | null }).user_id)
                .filter((id): id is string => !!id);
            setExistingUserIds(ids);
        }
        setLoadingMembers(false);
    };

    const handleSelectProfile = (profile: ProfileRow) => {
        setSelectedProfileId(profile.id);
        const fallback = profile.part ?? (subPartsByProfileId[profile.id] ?? [])[0] ?? "";
        setMemberInstrument(fallback);
    };

    const handleAddMember = async () => {
        if (!activeBand) return;
        if (!selectedProfileId) {
            toast.error("追加するメンバーを選択してください。");
            return;
        }
        const instrument = memberInstrument.trim();
        if (!instrument) {
            toast.error("担当パートを入力してください。");
            return;
        }

        const { error } = await supabase.from("band_members").insert({
            band_id: activeBand.id,
            user_id: selectedProfileId,
            instrument,
            order_index: existingUserIds.length + 1,
        });

        if (error) {
            console.error(error);
            toast.error("メンバーの追加に失敗しました。");
            return;
        }

        toast.success("メンバーを追加しました。");
        setIsMemberDialogOpen(false);
        setSelectedProfileId("");
        setMemberInstrument("");
        await onRefresh();
    };

    return (
        <Card className="bg-card/60">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">バンド一覧</CardTitle>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">イベント</label>
                    <select
                        value={selectedEventId}
                        onChange={(e) => onEventChange(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                    >
                        {events.length === 0 && <option value="">イベントがありません</option>}
                        {events.map((event) => (
                            <option key={event.id} value={event.id}>
                                {event.name} {event.date ? `(${formatDate(event.date)})` : ""}
                            </option>
                        ))}
                    </select>
                </div>
                {eventName && (
                    <p className="text-xs text-muted-foreground">
                        選択中: {eventName} {eventDate && `(${eventDate})`}
                    </p>
                )}
            </CardHeader>
            <CardContent className="space-y-3">
                {bands.length === 0 ? (
                    <div className="py-6 text-center">
                        <p className="text-sm text-muted-foreground">
                            このイベントにはまだバンドがありません。
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            下のフォームからバンドを作成してください。
                        </p>
                    </div>
                ) : (
                    bands.map((band) => {
                    const isOwner = band.created_by === userId;
                    const canDelete = isOwner || isAdmin;
                    const canManage = isOwner || isAdmin;

                    return (
                        <div
                            key={band.id}
                            className="rounded-lg border border-border bg-background/50 p-3 md:p-4"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-sm truncate">{band.name}</p>
                                        {band.isMember && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                                                参加中
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        メンバー {band.members}人
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {!band.isMember && (
                                        <>
                                            <Input
                                                value={joinInstruments[band.id] ?? ""}
                                                onChange={(e) =>
                                                    setJoinInstruments((prev) => ({
                                                        ...prev,
                                                        [band.id]: e.target.value,
                                                    }))
                                                }
                                                placeholder="担当パート"
                                                className="w-32 h-8 text-sm"
                                            />
                                            <Button size="sm" onClick={() => handleJoin(band.id)} className="h-8">
                                                参加する
                                            </Button>
                                        </>
                                    )}
                                    {canManage && (
                                        <Dialog
                                            open={isMemberDialogOpen && activeBand?.id === band.id}
                                            onOpenChange={(open) => {
                                                if (!open) {
                                                    setIsMemberDialogOpen(false);
                                                    setActiveBand(null);
                                                }
                                            }}
                                        >
                                            <DialogTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8"
                                                    onClick={() => openMemberDialog(band)}
                                                >
                                                    <UserPlus className="h-4 w-4 mr-1" />
                                                    メンバー追加
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>メンバーを追加</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    <Input
                                                        placeholder="名前・パートで検索"
                                                        value={memberSearch}
                                                        onChange={(e) => setMemberSearch(e.target.value)}
                                                        className="h-9"
                                                    />

                                                    <div className="border border-border rounded-lg max-h-[260px] overflow-y-auto">
                                                        {loadingMembers ? (
                                                            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                読み込み中...
                                                            </div>
                                                        ) : filteredProfiles.length === 0 ? (
                                                            <div className="py-6 text-sm text-muted-foreground text-center">
                                                                該当するメンバーがいません
                                                            </div>
                                                        ) : (
                                                            <div className="divide-y divide-border">
                                                                {filteredProfiles.map((profile) => (
                                                                    <button
                                                                        key={profile.id}
                                                                        type="button"
                                                                        onClick={() => handleSelectProfile(profile)}
                                                                        className={`w-full text-left px-3 py-2 hover:bg-muted ${
                                                                            selectedProfileId === profile.id
                                                                                ? "bg-primary/10"
                                                                                : ""
                                                                        }`}
                                                                    >
                                                                        <div className="text-sm font-medium">
                                                                            {profile.display_name || profile.real_name || "未設定"}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {profile.part ?? "未設定"}
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-2 items-end">
                                                        <div className="flex-1 space-y-1.5">
                                                            <label className="text-sm font-medium">担当パート</label>
                                                            <Input
                                                                value={memberInstrument}
                                                                onChange={(e) => setMemberInstrument(e.target.value)}
                                                                placeholder="例: Gt., Vo."
                                                                className="h-9"
                                                            />
                                                        </div>
                                                        <Button onClick={handleAddMember} className="h-9" disabled={!selectedProfileId}>
                                                            <Plus className="mr-1 h-4 w-4" />
                                                            追加
                                                        </Button>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                    {canDelete && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDelete(band)}
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
                )}
            </CardContent>
        </Card>
    );
}
