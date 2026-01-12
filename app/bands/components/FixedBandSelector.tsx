"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FixedBandSummary } from "../types";

type FixedBandSelectorProps = {
    bands: FixedBandSummary[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    loading: boolean;
};

export function FixedBandSelector({
    bands,
    selectedId,
    onSelect,
    loading,
}: FixedBandSelectorProps) {
    if (loading) {
        return (
            <Card className="bg-card/60">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">固定バンド一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        読み込み中...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (bands.length === 0) {
        return (
            <Card className="bg-card/60">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">固定バンド一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">固定バンドがありません。</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-card/60">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">固定バンド一覧</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {bands.map((band) => (
                    <button
                        key={band.id}
                        type="button"
                        onClick={() => onSelect(band.id)}
                        className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                            selectedId === band.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background/50 text-foreground hover:bg-muted"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{band.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                {band.members}人
                            </span>
                        </div>
                    </button>
                ))}
            </CardContent>
        </Card>
    );
}
