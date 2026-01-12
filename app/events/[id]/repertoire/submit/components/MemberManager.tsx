"use client";

import { useState } from "react";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageMember, ProfileOption, createTempId, getStageCategory, stageSlots } from "../types";

type MemberManagerProps = {
    members: StageMember[];
    profiles: ProfileOption[];
    myProfileId: string | null;
    setMembers: (members: StageMember[]) => void;
};

export function MemberManager({
    members,
    profiles,
    myProfileId,
    setMembers,
}: MemberManagerProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

    const getDefaultPosition = (instrument: string | null, part: string | null) => {
        const category = getStageCategory(instrument || part);
        const sameCategoryCount = members.filter(
            (m) => getStageCategory(m.instrument || m.part) === category
        ).length;
        const slot = stageSlots[category]?.[sameCategoryCount];
        if (slot) return slot;
        return {
            x: clampPercent(20 + (sameCategoryCount % 4) * 10),
            y: clampPercent(70 + Math.floor(sameCategoryCount / 4) * 6),
        };
    };

    const handleRemove = (id: string, userId: string) => {
        // 自分の削除は警告または不可にするべきだが、要件による。
        // ここでは単純に削除
        setMembers(members.filter((m) => m.id !== id));
    };

    const handleAddMember = (profile: ProfileOption) => {
        // 既に追加済みかチェック(profile.id は profile_id)
        // StageMemberのuserIdは user_id を想定しているが、ここでは一旦 profile.id で重複チェックを行うべきか?
        // 実装的には StageMember.userId に user_id を入れたい。

        // 既存メンバーチェック (user_id で比較)
        if (profile.user_id && members.some((m) => m.userId === profile.user_id)) {
            // 既にいる
            return;
        }

        const defaultPos = getDefaultPosition(profile.part ?? "", profile.part ?? null);
        const newMember: StageMember = {
            id: createTempId(),
            userId: profile.user_id ?? `temp-user-${profile.id}`,
            name: profile.display_name ?? "Unknown",
            realName: profile.real_name,
            part: profile.part,
            instrument: profile.part ?? "",
            x: defaultPos.x,
            y: defaultPos.y,
            monitorRequest: "",
            monitorNote: "",
            isMc: false,
        };

        setMembers([...members, newMember]);
        setIsAdding(false);
    };

    const handleUpdate = (id: string, key: keyof StageMember, value: any) => {
        setMembers(members.map(m => m.id === id ? { ...m, [key]: value } : m));
    };

    const filteredProfiles = profiles.filter((p) => {
        const search = searchTerm.trim().toLowerCase();
        const targetId = p.user_id ?? p.id;
        if (members.some((m) => m.userId === targetId)) return false;
        if (!search) return true;
        const combined = `${p.display_name ?? ""} ${p.real_name ?? ""} ${p.part ?? ""}`.toLowerCase();
        return combined.includes(search);
    });

    return (
        <Card className="bg-card/60">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>メンバー構成</CardTitle>
                        <CardDescription>
                            ステージに上がるメンバーとその担当楽器、モニター要望を登録します。
                        </CardDescription>
                    </div>
                    <Dialog open={isAdding} onOpenChange={setIsAdding}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <UserPlus className="w-4 h-4 mr-2" />
                                メンバー追加
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>メンバーを選択</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <Input
                                    placeholder="名前で検索..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <div className="max-h-[300px] overflow-y-auto space-y-2">
                                    {filteredProfiles.map((p) => (
                                        <div
                                            key={p.id}
                                            className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer border border-transparent hover:border-border"
                                            onClick={() => handleAddMember(p)}
                                        >
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {p.real_name ?? p.display_name ?? "名前未設定"}
                                                </p>
                                                {p.real_name && p.display_name && (
                                                    <p className="text-xs text-muted-foreground">{p.display_name}</p>
                                                )}
                                                <p className="text-xs text-muted-foreground">{p.part}</p>
                                            </div>
                                            <Plus className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    ))}
                                    {filteredProfiles.length === 0 && (
                                        <p className="text-sm text-center text-muted-foreground py-4">
                                            見つかりません
                                        </p>
                                    )}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px]">名前</TableHead>
                                <TableHead className="w-[150px]">パート/楽器</TableHead>
                                <TableHead>モニター要望</TableHead>
                                <TableHead className="w-[80px] text-center">MC</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.map((member) => {
                                const primaryName = member.realName ?? member.name;
                                const secondaryName = member.realName ? member.name : null;
                                return (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium">
                                            {primaryName}
                                            {secondaryName && (
                                                <span className="block text-xs text-muted-foreground">{secondaryName}</span>
                                            )}
                                        </TableCell>
                                    <TableCell>
                                        <Input
                                            value={member.instrument}
                                            onChange={(e) => handleUpdate(member.id, "instrument", e.target.value)}
                                            placeholder="例: Gt.1"
                                            className="h-8"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            value={member.monitorRequest}
                                            onChange={(e) => handleUpdate(member.id, "monitorRequest", e.target.value)}
                                            placeholder="ボーカル大きめ"
                                            className="h-8"
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <input
                                            type="checkbox"
                                            checked={member.isMc}
                                            onChange={(e) => handleUpdate(member.id, "isMc", e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleRemove(member.id, member.userId)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                    </TableRow>
                                );
                            })}
                            {members.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                        メンバーがいません
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
