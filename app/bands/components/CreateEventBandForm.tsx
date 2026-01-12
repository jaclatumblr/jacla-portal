"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import type { EventRow, FixedBandSummary } from "../types";
import { formatDate } from "../types";

type CreateEventBandFormProps = {
    events: EventRow[];
    selectedEventId: string;
    onEventChange: (id: string) => void;
    fixedBands: FixedBandSummary[];
    selfPart: string;
    onCreated: () => Promise<void>;
    showEventSelect?: boolean;
};

export function CreateEventBandForm({
    events,
    selectedEventId,
    onEventChange,
    fixedBands,
    selfPart,
    onCreated,
    showEventSelect = true,
}: CreateEventBandFormProps) {
    const { session } = useAuth();
    const userId = session?.user.id ?? null;

    // 新規作成用
    const [bandName, setBandName] = useState("");
    const [instrument, setInstrument] = useState(selfPart);
    const [creating, setCreating] = useState(false);

    // 固定バンドから作成用
    const [sourceBandId, setSourceBandId] = useState("");
    const [cloneBandName, setCloneBandName] = useState("");
    const [creatingFromFixed, setCreatingFromFixed] = useState(false);
    const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

    // 固定バンド選択時に名前をセット
    const handleSourceChange = (id: string) => {
        setSourceBandId(id);
        const band = fixedBands.find((b) => b.id === id);
        setCloneBandName(band?.name ?? "");
    };

    const handleCreate = async () => {
        if (!userId) return;
        const name = bandName.trim();
        const inst = instrument.trim();

        if (!selectedEventId) {
            toast.error("イベントを選択してください。");
            return;
        }
        if (!name) {
            toast.error("バンド名を入力してください。");
            return;
        }
        if (!inst) {
            toast.error("担当パートを入力してください。");
            return;
        }

        setCreating(true);
        const { data: bandData, error: bandError } = await supabase
            .from("bands")
            .insert({
                name,
                band_type: "event",
                event_id: selectedEventId,
                created_by: userId,
            })
            .select("id")
            .maybeSingle();

        if (bandError || !bandData) {
            console.error(bandError);
            toast.error("イベントバンドの作成に失敗しました。");
            setCreating(false);
            return;
        }

        const { error: memberError } = await supabase.from("band_members").insert({
            band_id: bandData.id,
            user_id: userId,
            instrument: inst,
            order_index: 1,
        });

        if (memberError) {
            console.error(memberError);
            toast.error("作成者の参加登録に失敗しました。");
        } else {
            toast.success("イベントバンドを作成しました。");
        }

        setBandName("");
        setInstrument(selfPart || "");
        setCreating(false);
        await onCreated();
    };

    const handleCreateFromFixed = async () => {
        if (!userId) return;
        if (!selectedEventId || !sourceBandId) {
            toast.error("イベントと固定バンドを選択してください。");
            return;
        }
        const name = cloneBandName.trim();
        if (!name) {
            toast.error("バンド名を入力してください。");
            return;
        }

        setCreatingFromFixed(true);

        const { data: bandData, error: bandError } = await supabase
            .from("bands")
            .insert({
                name,
                band_type: "event",
                event_id: selectedEventId,
                created_by: userId,
                source_band_id: sourceBandId,
            })
            .select("id")
            .maybeSingle();

        if (bandError || !bandData) {
            console.error(bandError);
            toast.error("イベントバンドの作成に失敗しました。");
            setCreatingFromFixed(false);
            return;
        }

        // 元バンドのメンバーをコピー
        const { data: membersData, error: membersError } = await supabase
            .from("band_members")
            .select("user_id, instrument, order_index")
            .eq("band_id", sourceBandId)
            .order("order_index", { ascending: true });

        if (membersError) {
            console.error(membersError);
        }

        const payload = (membersData ?? []).map((row, index) => {
            const entry = row as {
                user_id?: string | null;
                instrument?: string | null;
                order_index?: number | null;
            };
            return {
                band_id: bandData.id,
                user_id: entry.user_id ?? "",
                instrument: entry.instrument ?? "",
                order_index: entry.order_index ?? index + 1,
            };
        });

        // 自分が含まれていなければ追加
        const hasSelf = payload.some((entry) => entry.user_id === userId);
        if (!hasSelf) {
            payload.push({
                band_id: bandData.id,
                user_id: userId,
                instrument: selfPart || instrument || "未設定",
                order_index: payload.length + 1,
            });
        }

        if (payload.length > 0) {
            const { error: insertError } = await supabase.from("band_members").insert(payload);
            if (insertError) {
                console.error(insertError);
                toast.error("メンバーの複製に失敗しました。");
            }
        }

        toast.success("固定バンドからイベントバンドを作成しました。");
        setSourceBandId("");
        setCloneBandName("");
        setCreatingFromFixed(false);
        await onCreated();
    };

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            {/* 新規作成 */}
            <Card className="bg-card/60">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        新規バンド作成
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {showEventSelect ? (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">イベント</label>
                            <select
                                value={selectedEventId}
                                onChange={(e) => onEventChange(e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                            >
                                {events.length === 0 && <option value="">イベントがありません</option>}
                                {events.map((event) => (
                                    <option key={event.id} value={event.id}>
                                        {event.name} ({formatDate(event.date)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">イベント</label>
                            <div className="h-9 w-full rounded-md border border-input bg-muted/60 px-3 text-sm flex items-center text-foreground">
                                {selectedEvent
                                    ? `${selectedEvent.name} (${formatDate(selectedEvent.date)})`
                                    : "イベント未選択"}
                            </div>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">バンド名</label>
                        <Input
                            value={bandName}
                            onChange={(e) => setBandName(e.target.value)}
                            placeholder="例: Jacla Special"
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">あなたの担当パート</label>
                        <Input
                            value={instrument}
                            onChange={(e) => setInstrument(e.target.value)}
                            placeholder="例: Gt., Vo."
                            className="h-9"
                        />
                    </div>
                    <Button onClick={handleCreate} disabled={creating} className="w-full" size="sm">
                        {creating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                作成中...
                            </>
                        ) : (
                            "バンドを作成"
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* 固定バンドから作成 */}
            <Card className="bg-card/60">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base">固定バンドから作成</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">コピー元</label>
                        <select
                            value={sourceBandId}
                            onChange={(e) => handleSourceChange(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                        >
                            <option value="">固定バンドを選択</option>
                            {fixedBands.map((band) => (
                                <option key={band.id} value={band.id}>
                                    {band.name} ({band.members}人)
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">イベントバンド名</label>
                        <Input
                            value={cloneBandName}
                            onChange={(e) => setCloneBandName(e.target.value)}
                            placeholder="例: 固定バンド名"
                            className="h-9"
                        />
                    </div>
                    <Button
                        onClick={handleCreateFromFixed}
                        disabled={creatingFromFixed || !sourceBandId}
                        className="w-full"
                        size="sm"
                        variant="secondary"
                    >
                        {creatingFromFixed ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                作成中...
                            </>
                        ) : (
                            "メンバーをコピーして作成"
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
