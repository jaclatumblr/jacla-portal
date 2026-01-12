"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { FixedBandSummary, FixedMember, ProfileRow } from "../types";

type FixedBandDetailProps = {
    band: FixedBandSummary | null;
    members: FixedMember[];
    membersLoading: boolean;
    profiles: ProfileRow[];
    subPartsByProfileId: Record<string, string[]>;
    getFilteredProfiles: (existingUserIds: string[], query: string) => ProfileRow[];
    onRefreshBands: () => Promise<void>;
    onRefreshMembers: () => Promise<void>;
};

export function FixedBandDetail({
    band,
    members,
    membersLoading,
    profiles,
    subPartsByProfileId,
    getFilteredProfiles,
    onRefreshBands,
    onRefreshMembers,
}: FixedBandDetailProps) {
    const { session } = useAuth();
    const { isAdmin, isPaLeader, isLightingLeader, isPartLeader } = useRoleFlags();
    const userId = session?.user.id ?? null;

    const [memberSearch, setMemberSearch] = useState("");
    const [selectedProfileId, setSelectedProfileId] = useState("");
    const [memberInstrument, setMemberInstrument] = useState("");

    const canManage =
        !!band &&
        (band.created_by === userId || isAdmin || isPaLeader || isLightingLeader || isPartLeader);

    const filteredProfiles = useMemo(() => {
        const existingIds = members.map((m) => m.userId);
        return getFilteredProfiles(existingIds, memberSearch);
    }, [members, memberSearch, getFilteredProfiles]);

    const handleSelectProfile = (profile: ProfileRow) => {
        setSelectedProfileId(profile.id);
        const fallback = profile.part ?? (subPartsByProfileId[profile.id] ?? [])[0] ?? "";
        setMemberInstrument(fallback);
    };

    const handleAddMember = async () => {
        if (!band) {
            toast.error("固定バンドを選択してください。");
            return;
        }
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
            band_id: band.id,
            user_id: selectedProfileId,
            instrument,
            order_index: members.length + 1,
        });

        if (error) {
            console.error(error);
            toast.error("メンバーの追加に失敗しました。");
            return;
        }

        toast.success("メンバーを追加しました。");
        setSelectedProfileId("");
        setMemberInstrument("");
        await onRefreshMembers();
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!band || !canManage) {
            toast.error("削除権限がありません。");
            return;
        }

        const { error } = await supabase.from("band_members").delete().eq("id", memberId);
        if (error) {
            console.error(error);
            toast.error("メンバーの削除に失敗しました。");
            return;
        }

        toast.success("メンバーを削除しました。");
        await onRefreshMembers();
    };

    const handleDeleteBand = async () => {
        if (!band || !userId) return;
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
        await onRefreshBands();
    };

    if (!band) {
        return (
            <Card className="bg-card/60">
                <CardContent className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        左のリストから固定バンドを選択してください。
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-card/60">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{band.name}</CardTitle>
                    {(band.created_by === userId || isAdmin) && (
                        <Button size="sm" variant="ghost" onClick={handleDeleteBand}>
                            <Trash2 className="mr-1 h-4 w-4" />
                            削除
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* メンバー一覧 */}
                <div>
                    <h3 className="text-sm font-semibold mb-3">メンバー</h3>
                    {membersLoading ? (
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            読み込み中...
                        </div>
                    ) : members.length === 0 ? (
                        <p className="text-sm text-muted-foreground">メンバーが登録されていません。</p>
                    ) : (
                        <div className="border border-border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>名前</TableHead>
                                        <TableHead>担当パート</TableHead>
                                        <TableHead className="text-right">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {members.map((member) => (
                                        <TableRow key={member.id}>
                                            <TableCell>
                                                <div className="text-sm font-medium">
                                                    {member.displayName || member.realName || "未設定"}
                                                </div>
                                                {member.realName && member.displayName && (
                                                    <div className="text-xs text-muted-foreground">{member.realName}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {member.instrument}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleRemoveMember(member.id)}
                                                    disabled={!canManage}
                                                    className="h-7"
                                                >
                                                    削除
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {/* メンバー追加 */}
                <div className="border-t border-border pt-6 space-y-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold">メンバーを追加</h3>
                        <p className="text-xs text-muted-foreground">
                            検索結果: {filteredProfiles.length}件
                        </p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="名前・パートで検索"
                            className="pl-10 h-9"
                        />
                    </div>

                    <div className="border border-border rounded-lg max-h-[240px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>名前</TableHead>
                                    <TableHead>パート</TableHead>
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProfiles.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-sm text-muted-foreground text-center">
                                            該当するメンバーがいません
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProfiles.slice(0, 20).map((profile) => (
                                        <TableRow
                                            key={profile.id}
                                            onClick={() => handleSelectProfile(profile)}
                                            className={cn(
                                                "cursor-pointer",
                                                selectedProfileId === profile.id && "bg-primary/10"
                                            )}
                                        >
                                            <TableCell>
                                                <div className="font-medium text-sm">
                                                    {profile.display_name || profile.real_name || "未設定"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {profile.part ?? "未設定"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectProfile(profile);
                                                    }}
                                                    className="h-7"
                                                >
                                                    選択
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
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
            </CardContent>
        </Card>
    );
}
