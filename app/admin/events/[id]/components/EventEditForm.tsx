"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import {
    EventRow,
    statusOptions,
    eventTypeOptions,
    statusLabel,
    statusBadge,
} from "../types";

type EventEditFormProps = {
    event: EventRow;
    onRefresh: () => Promise<void>;
};

export function EventEditForm({ event, onRefresh }: EventEditFormProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<EventRow>(event);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    useEffect(() => {
        setFormData(event);
    }, [event]);

    const handleChange = (key: keyof EventRow, value: any) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from("events")
            .update({
                name: formData.name,
                date: formData.date,
                status: formData.status,
                event_type: formData.event_type,
                venue: formData.venue || null,
                open_time: formData.open_time || null,
                start_time: formData.start_time || null,
                note: formData.note || null,
                default_changeover_min: formData.default_changeover_min,
                tt_is_published: formData.tt_is_published,
                tt_is_provisional: formData.tt_is_provisional,
            })
            .eq("id", event.id);

        if (error) {
            console.error(error);
            toast.error("イベントの保存に失敗しました。");
        } else {
            toast.success("イベント情報を保存しました。");
            await onRefresh();
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (deleteConfirmText !== event.name) return;
        setDeleting(true);
        const { error } = await supabase.from("events").delete().eq("id", event.id);
        if (error) {
            console.error(error);
            toast.error("イベントの削除に失敗しました。");
            setDeleting(false);
        } else {
            toast.success("イベントを削除しました。");
            router.push("/admin");
        }
    };

    return (
        <div className="space-y-6">
            <Card className="bg-card/60">
                <CardHeader>
                    <CardTitle className="text-lg">基本情報</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">イベント名</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => handleChange("name", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">開催日</label>
                            <Input
                                type="date"
                                value={formData.date}
                                onChange={(e) => handleChange("date", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ステータス</label>
                            <select
                                value={formData.status}
                                onChange={(e) => handleChange("status", e.target.value)}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                {statusOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">種別</label>
                            <select
                                value={formData.event_type}
                                onChange={(e) => handleChange("event_type", e.target.value)}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                {eventTypeOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">会場</label>
                            <Input
                                value={formData.venue ?? ""}
                                onChange={(e) => handleChange("venue", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">開場時間</label>
                            <Input
                                type="time"
                                value={formData.open_time ?? ""}
                                onChange={(e) => handleChange("open_time", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">開演時間</label>
                            <Input
                                type="time"
                                value={formData.start_time ?? ""}
                                onChange={(e) => handleChange("start_time", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">メモ</label>
                        <Textarea
                            value={formData.note ?? ""}
                            onChange={(e) => handleChange("note", e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="pt-2 border-t border-border">
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">転換時間（デフォルト分）</label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={formData.default_changeover_min}
                                    onChange={(e) =>
                                        handleChange("default_changeover_min", Number(e.target.value))
                                    }
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.tt_is_published}
                                    onChange={(e) => handleChange("tt_is_published", e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-sm">タイムテーブルを公開する</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.tt_is_provisional}
                                    onChange={(e) => handleChange("tt_is_provisional", e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-sm">「仮」マークを表示</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        {!showDeleteConfirm ? (
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                イベント削除
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2 flex-1 max-w-md">
                                <Input
                                    placeholder="イベント名を入力して確認"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    className="h-9 text-sm"
                                />
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDelete}
                                    disabled={deleting || deleteConfirmText !== event.name}
                                >
                                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "削除実行"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeleteConfirmText("");
                                    }}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        )}

                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            保存
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
