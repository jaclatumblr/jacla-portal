"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  ProfileOption,
  StageMember,
  adminLeaderSet,
  createTempId,
  getStageCategory,
  stageSlots,
} from "../types";

type MemberManagerProps = {
  members: StageMember[];
  profiles: ProfileOption[];
  myProfileId: string | null;
  setMembers: (members: StageMember[]) => void;
  readOnly?: boolean;
};

export function MemberManager({ members, profiles, myProfileId, setMembers, readOnly }: MemberManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

  const getDefaultPosition = (instrument: string | null, part: string | null) => {
    const category = getStageCategory(instrument || part);
    const sameCategoryCount = members.filter(
      (member) => getStageCategory(member.instrument || member.part) === category
    ).length;
    const slot = stageSlots[category]?.[sameCategoryCount];
    if (slot) return slot;
    return {
      x: clampPercent(20 + (sameCategoryCount % 4) * 10),
      y: clampPercent(70 + Math.floor(sameCategoryCount / 4) * 6),
    };
  };

  const handleRemove = (id: string) => {
    if (readOnly) return;
    setMembers(members.filter((member) => member.id !== id));
  };

  const handleAddMember = (profile: ProfileOption) => {
    if (readOnly) return;
    if (members.some((member) => member.userId === profile.id)) {
      return;
    }

    const defaultPos = getDefaultPosition(profile.part ?? "", profile.part ?? null);
    const newMember: StageMember = {
      id: createTempId(),
      userId: profile.id,
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
    setMembers(members.map((member) => (member.id === id ? { ...member, [key]: value } : member)));
  };

  const filteredProfiles = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const memberIds = new Set(members.map((m) => m.userId));
    
    return profiles.filter((profile) => {
      if (memberIds.has(profile.id)) return false;
      if (adminLeaderSet.has(profile.leader ?? "")) return false;
      if (!search) return true;
      const combined = `${profile.display_name ?? ""} ${profile.real_name ?? ""} ${profile.part ?? ""}`.toLowerCase();
      return combined.includes(search);
    });
  }, [profiles, members, searchTerm]);

  return (
    <Card className="bg-card/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>メンバー構成</CardTitle>
            <CardDescription>
              ステージに上がるメンバーと担当パート、返し要望を登録します。
            </CardDescription>
          </div>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={readOnly}>
                <UserPlus className="mr-2 h-4 w-4" />
                メンバー追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>メンバーを選択</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input disabled={readOnly}
                  placeholder="名前で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {filteredProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex cursor-pointer items-center justify-between rounded border border-transparent p-2 hover:border-border hover:bg-muted"
                      onClick={() => handleAddMember(profile)}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {profile.real_name ?? profile.display_name ?? "名前未設定"}
                        </p>
                        {profile.real_name && profile.display_name && (
                          <p className="text-xs text-muted-foreground">{profile.display_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{profile.part}</p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                  {filteredProfiles.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">見つかりません</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 md:hidden">
          {members.map((member) => {
            const primaryName = member.realName ?? member.name;
            const secondaryName = member.realName ? member.name : null;
            return (
              <div key={member.id} className="rounded-md border border-border bg-card/40 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{primaryName}</p>
                    {secondaryName && (
                      <span className="block text-xs text-muted-foreground truncate">{secondaryName}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={readOnly}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(member.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs text-muted-foreground">パート/楽器</label>
                  <Input
                    disabled={readOnly}
                    value={member.instrument}
                    onChange={(e) => handleUpdate(member.id, "instrument", e.target.value)}
                    placeholder="例: Gt.1 / 管1 / LINE2"
                    className="h-9"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs text-muted-foreground">返し要望</label>
                  <Input
                    disabled={readOnly}
                    value={member.monitorRequest}
                    onChange={(e) => handleUpdate(member.id, "monitorRequest", e.target.value)}
                    placeholder="ボーカル大きめ"
                    className="h-9"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={member.isMc}
                    onChange={(e) => handleUpdate(member.id, "isMc", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  MC
                </label>
              </div>
            );
          })}
          {members.length === 0 && (
            <div className="rounded-md border border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
              メンバーがいません
            </div>
          )}
        </div>

        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">名前</TableHead>
                <TableHead className="w-[150px]">パート/楽器</TableHead>
                <TableHead>返し要望</TableHead>
                <TableHead className="w-[80px] text-center">MC</TableHead>
                <TableHead className="w-[50px]" />
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
                        disabled={readOnly}
                        value={member.instrument}
                        onChange={(e) => handleUpdate(member.id, "instrument", e.target.value)}
                        placeholder="例: Gt.1 / 管1 / LINE2"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        disabled={readOnly}
                        value={member.monitorRequest}
                        onChange={(e) => handleUpdate(member.id, "monitorRequest", e.target.value)}
                        placeholder="ボーカル大きめ"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={member.isMc}
                        onChange={(e) => handleUpdate(member.id, "isMc", e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={readOnly}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">
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
