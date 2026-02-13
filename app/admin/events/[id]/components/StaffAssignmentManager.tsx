"use client";

import { useMemo, useState } from "react";
import { Loader2, Save, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatTimeText } from "@/lib/time";
import type {
    EventSlot,
    EventStaffMember,
    SlotStaffAssignment,
    ProfileOption,
    Band,
} from "../types";

type StaffAssignmentManagerProps = {
    eventId: string;
    slots: EventSlot[];
    eventStaff: EventStaffMember[];
    staffAssignments: SlotStaffAssignment[];
    profiles: ProfileOption[];
    bands: Band[];
    setStaffAssignments: (
        updater: (prev: SlotStaffAssignment[]) => SlotStaffAssignment[]
    ) => void;
};

export function StaffAssignmentManager({
    eventId,
    slots,
    eventStaff,
    staffAssignments,
    profiles,
    bands,
    setStaffAssignments,
}: StaffAssignmentManagerProps) {
    const [saving, setSaving] = useState(false);
    const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({}); // slotId:role -> profileId

    const bandNameMap = useMemo(() => {
        const map = new Map<string, string>();
        bands.forEach((band) => map.set(band.id, band.name));
        return map;
    }, [bands]);

    const profileMap = useMemo(() => {
        const map = new Map<string, ProfileOption>();
        profiles.forEach((p) => map.set(p.id, p));
        return map;
    }, [profiles]);

    const assignmentsBySlot = useMemo(() => {
        const map = new Map<string, { pa: SlotStaffAssignment[]; light: SlotStaffAssignment[] }>();
        staffAssignments.forEach((assignment) => {
            const bucket = map.get(assignment.event_slot_id) ?? { pa: [], light: [] };
            if (assignment.role === "pa") {
                bucket.pa.push(assignment);
            } else {
                bucket.light.push(assignment);
            }
            map.set(assignment.event_slot_id, bucket);
        });
        return map;
    }, [staffAssignments]);

    const orderedSlots = useMemo(() => {
        return [...slots].sort((a, b) => {
            const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            const startA = a.start_time ?? "";
            const startB = b.start_time ?? "";
            if (startA !== startB) return startA.localeCompare(startB);
            return (a.note ?? "").localeCompare(b.note ?? "");
        });
    }, [slots]);

    const handleAddAssignment = async (slotId: string, role: "pa" | "light") => {
        const draftKey = `${slotId}:${role}`;
        const profileId = assignmentDrafts[draftKey];
        if (!profileId) return;

        // 既に割り当てられていないか確認
        const existing = staffAssignments.find(
            (a) => a.event_slot_id === slotId && a.role === role && a.profile_id === profileId
        );
        if (existing) {
            toast.error("既に追加されています。");
            return;
        }

        const { data, error } = await supabase
            .from("slot_staff_assignments")
            .insert({
                event_slot_id: slotId,
                profile_id: profileId,
                role,
                is_fixed: false,
            })
            .select("id, event_slot_id, profile_id, role, is_fixed, note")
            .single();

        if (error || !data) {
            console.error(error);
            toast.error("追加に失敗しました。");
            return;
        }

        setStaffAssignments((prev) => [...prev, data]);
        setAssignmentDrafts((prev) => ({ ...prev, [draftKey]: "" }));
    };

    const handleRemoveAssignment = async (assignmentId: string) => {
        const { error } = await supabase
            .from("slot_staff_assignments")
            .delete()
            .eq("id", assignmentId);

        if (error) {
            console.error(error);
            toast.error("削除に失敗しました。");
            return;
        }

        setStaffAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    };

    const handleAutoAssign = async () => {
        if (saving) return;
        setSaving(true);

        const addAssignments: any[] = [];

        (["pa", "light"] as const).forEach((role) => {
            const eligible = eventStaff
                .filter((staff) => (role === "pa" ? staff.can_pa : staff.can_light))
                .map((staff) => staff.profile_id);

            if (eligible.length === 0) return;

            const existingBySlot = new Set(
                staffAssignments
                    .filter((a) => a.role === role)
                    .map((a) => a.event_slot_id)
            );

            let cursor = 0;
            orderedSlots.forEach((slot) => {
                if (existingBySlot.has(slot.id)) return;
                // すでにこのスロットにこのロールがあればスキップ（簡易ロジック）
                // 今回の要件では複数人OKだが、自動割当としては1人ずつ埋めるのが自然

                const profileId = eligible[cursor % eligible.length];
                addAssignments.push({
                    event_slot_id: slot.id,
                    profile_id: profileId,
                    role,
                    is_fixed: false,
                });
                cursor++;
            });
        });

        if (addAssignments.length === 0) {
            toast.success("割り当て可能な空きスロットがありません。");
            setSaving(false);
            return;
        }

        const { data, error } = await supabase
            .from("slot_staff_assignments")
            .insert(addAssignments)
            .select("id, event_slot_id, profile_id, role, is_fixed, note");

        if (error || !data) {
            console.error(error);
            toast.error("自動割り当てに失敗しました。");
        } else {
            setStaffAssignments(prev => [...prev, ...data]);
            toast.success(`${data.length}件の割り当てを追加しました。`);
        }
        setSaving(false);
    };

    const getSlotLabel = (slot: EventSlot) => {
        if (slot.slot_type === "band") {
            return bandNameMap.get(slot.band_id ?? "") ?? "バンド未設定";
        }
        const note = slot.note?.trim() ?? "";
        if (slot.slot_type === "break" || note.includes("転換")) return "転換";
        if (slot.slot_type === "mc") return "付帯作業";
        return note || "付帯作業";
    };

    const getSlotTime = (slot: EventSlot) => {
  const startText = formatTimeText(slot.start_time);
  const endText = formatTimeText(slot.end_time);
  if (startText && endText) return `${startText} - ${endText}`;
  return startText ?? endText ?? "?????";
};

    return (
        <Card className="bg-card/60">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">スタッフ割り当て</CardTitle>
                        <CardDescription>
                            各スロットのPA・照明担当を割り当てます。
                        </CardDescription>
                    </div>
                    <Button onClick={handleAutoAssign} disabled={saving} variant="outline" size="sm">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "自動割り当て"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {orderedSlots.map((slot) => {
                        const current = assignmentsBySlot.get(slot.id) ?? { pa: [], light: [] };

                        return (
                            <div key={slot.id} className="border border-border rounded-lg p-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                    <div className="font-medium flex items-center gap-2">
                                        <Badge variant="outline">{slot.order_in_event}</Badge>
                                        <span>{getSlotLabel(slot)}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                        {getSlotTime(slot)}
                                    </div>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    {/* PA Area */}
                                    <div className="bg-background/50 p-2 rounded border border-border/50">
                                        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500" /> PA
                                        </div>
                                        <div className="space-y-2">
                                            {current.pa.map(assign => (
                                                <div key={assign.id} className="flex items-center justify-between bg-card text-xs p-1.5 rounded border border-border">
                                                    <span>{profileMap.get(assign.profile_id)?.display_name ?? "不明"}</span>
                                                    <button
                                                        onClick={() => handleRemoveAssignment(assign.id)}
                                                        className="text-muted-foreground hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="flex items-center gap-1">
                                                <select
                                                    className="flex-1 h-7 text-xs rounded border border-input bg-background px-1"
                                                    value={assignmentDrafts[`${slot.id}:pa`] ?? ""}
                                                    onChange={(e) => setAssignmentDrafts(prev => ({ ...prev, [`${slot.id}:pa`]: e.target.value }))}
                                                >
                                                    <option value="">追加...</option>
                                                    {eventStaff.filter(s => s.can_pa).map(staff => (
                                                        <option key={staff.profile_id} value={staff.profile_id}>
                                                            {profileMap.get(staff.profile_id)?.display_name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => handleAddAssignment(slot.id, "pa")}
                                                    disabled={!assignmentDrafts[`${slot.id}:pa`]}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lighting Area */}
                                    <div className="bg-background/50 p-2 rounded border border-border/50">
                                        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-yellow-500" /> 照明
                                        </div>
                                        <div className="space-y-2">
                                            {current.light.map(assign => (
                                                <div key={assign.id} className="flex items-center justify-between bg-card text-xs p-1.5 rounded border border-border">
                                                    <span>{profileMap.get(assign.profile_id)?.display_name ?? "不明"}</span>
                                                    <button
                                                        onClick={() => handleRemoveAssignment(assign.id)}
                                                        className="text-muted-foreground hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="flex items-center gap-1">
                                                <select
                                                    className="flex-1 h-7 text-xs rounded border border-input bg-background px-1"
                                                    value={assignmentDrafts[`${slot.id}:light`] ?? ""}
                                                    onChange={(e) => setAssignmentDrafts(prev => ({ ...prev, [`${slot.id}:light`]: e.target.value }))}
                                                >
                                                    <option value="">追加...</option>
                                                    {eventStaff.filter(s => s.can_light).map(staff => (
                                                        <option key={staff.profile_id} value={staff.profile_id}>
                                                            {profileMap.get(staff.profile_id)?.display_name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => handleAddAssignment(slot.id, "light")}
                                                    disabled={!assignmentDrafts[`${slot.id}:light`]}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
