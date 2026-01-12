"use client";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save, Loader2, RotateCcw } from "lucide-react";

type EventHeaderProps = {
    eventName: string;
    bandName: string;
    status: "draft" | "submitted";
    lastSavedAt: string | null;
    saving: boolean;
    onSave: (status: "draft" | "submitted") => Promise<void>;
    onReset: () => void;
    showReset: boolean;
};

export function EventHeader({
    eventName,
    bandName,
    status,
    lastSavedAt,
    saving,
    onSave,
    onReset,
    showReset,
}: EventHeaderProps) {
    return (
        <PageHeader
            kicker={eventName}
            title="提出情報の編集"
            description={`「${bandName}」のセットリスト、ステージ配置、メンバー情報を管理します。`}
            backHref={`/me/bands`}
            backLabel="バンド管理に戻る"
            actions={
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                        {showReset && (
                            <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                リセット
                            </Button>
                        )}
                        <Badge variant={status === "submitted" ? "secondary" : "outline"}>
                            {status === "submitted" ? "提出済み" : "下書き"}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onSave("draft")}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            一時保存
                        </Button>
                        <Button
                            onClick={() => onSave("submitted")}
                            disabled={saving}
                        >
                            提出する
                        </Button>
                    </div>
                    {lastSavedAt && (
                        <p className="text-xs text-muted-foreground text-right">
                            最終保存: {lastSavedAt}
                        </p>
                    )}
                </div>
            }
        />
    );
}
