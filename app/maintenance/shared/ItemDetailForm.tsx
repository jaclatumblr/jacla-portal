"use client";

import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { MaintenanceStatus, BaseMaintenanceLog, ProfileInfo } from "./types";
import { statusOptions, formatDateTime } from "./types";

type CategoryOption<T extends string> = {
    value: T;
    label: string;
};

type ItemDetailFormProps<C extends string> = {
    // 編集対象
    selectedId: string | null;
    updatedAt: string | null;
    // フォーム値
    name: string;
    setName: (value: string) => void;
    category: C;
    setCategory: (value: C) => void;
    categoryOptions: CategoryOption<C>[];
    categoryLabel: string;
    manufacturer: string;
    setManufacturer: (value: string) => void;
    model: string;
    setModel: (value: string) => void;
    location: string;
    setLocation: (value: string) => void;
    quantity: string;
    setQuantity: (value: string) => void;
    status: MaintenanceStatus;
    setStatus: (value: MaintenanceStatus) => void;
    notes: string;
    setNotes: (value: string) => void;
    // 状態
    canEdit: boolean;
    saving: boolean;
    roleLoading: boolean;
    onSave: () => void;
    // ログ
    logs: BaseMaintenanceLog[];
    logsLoading: boolean;
};

export function ItemDetailForm<C extends string>({
    selectedId,
    updatedAt,
    name,
    setName,
    category,
    setCategory,
    categoryOptions,
    categoryLabel,
    manufacturer,
    setManufacturer,
    model,
    setModel,
    location,
    setLocation,
    quantity,
    setQuantity,
    status,
    setStatus,
    notes,
    setNotes,
    canEdit,
    saving,
    roleLoading,
    onSave,
    logs,
    logsLoading,
}: ItemDetailFormProps<C>) {
    return (
        <div className="space-y-6">
            <Card className="bg-card/60 border-border">
                <CardHeader>
                    <CardTitle className="text-lg">詳細</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!canEdit && (
                        <div className="text-xs text-muted-foreground">
                            編集権限がありません。開放中の場合のみ更新できます。
                        </div>
                    )}

                    <label className="space-y-1 block text-sm">
                        <span className="text-foreground">名前</span>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!canEdit || roleLoading}
                        />
                    </label>

                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                            <span className="text-foreground">{categoryLabel}</span>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as C)}
                                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                                disabled={!canEdit || roleLoading}
                            >
                                {categoryOptions.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1 block text-sm">
                            <span className="text-foreground">状態</span>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}
                                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                                disabled={!canEdit || roleLoading}
                            >
                                {statusOptions.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block text-sm">
                            <span className="text-foreground">メーカー</span>
                            <Input
                                value={manufacturer}
                                onChange={(e) => setManufacturer(e.target.value)}
                                disabled={!canEdit || roleLoading}
                            />
                        </label>
                        <label className="space-y-1 block text-sm">
                            <span className="text-foreground">型番</span>
                            <Input
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                disabled={!canEdit || roleLoading}
                            />
                        </label>
                    </div>

                    <label className="space-y-1 block text-sm">
                        <span className="text-foreground">保管場所</span>
                        <Input
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            disabled={!canEdit || roleLoading}
                        />
                    </label>

                    <label className="space-y-1 block text-sm">
                        <span className="text-foreground">数量</span>
                        <Input
                            type="number"
                            min={0}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            disabled={!canEdit || roleLoading}
                        />
                    </label>

                    <label className="space-y-1 block text-sm">
                        <span className="text-foreground">メモ</span>
                        <Textarea
                            rows={4}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={!canEdit || roleLoading}
                        />
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={onSave} disabled={!canEdit || saving || roleLoading} className="gap-2">
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            保存
                        </Button>
                        {updatedAt && (
                            <span className="text-xs text-muted-foreground">
                                更新: {formatDateTime(updatedAt)}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
                <CardHeader>
                    <CardTitle className="text-lg">履歴</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {!selectedId && (
                        <p className="text-xs text-muted-foreground">
                            アイテムを選択すると履歴を表示します。
                        </p>
                    )}
                    {selectedId && logsLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            読み込み中...
                        </div>
                    )}
                    {selectedId && !logsLoading && logs.length === 0 && (
                        <p className="text-xs text-muted-foreground">まだ履歴がありません。</p>
                    )}
                    {logs.map((log) => {
                        const actor =
                            log.profiles?.real_name ?? log.profiles?.display_name ?? "Unknown";
                        return (
                            <div
                                key={log.id}
                                className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={log.status} />
                                        <span className="text-foreground">{actor}</span>
                                    </div>
                                    <span className="text-muted-foreground">{formatDateTime(log.created_at)}</span>
                                </div>
                                {log.note && <div className="text-muted-foreground">{log.note}</div>}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
