"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadExcelFile } from "@/lib/exportExcel";
import { toast } from "@/lib/toast";
import type { Member } from "../types";

type ExportButtonsProps = {
    members: Member[];
    canExport: boolean;
    canViewStudentId: boolean;
};

export function ExportButtons({ members, canExport, canViewStudentId }: ExportButtonsProps) {
    const handleExport = (scope: "all" | "pa" | "lighting") => {
        if (!canExport) {
            toast.error("エクスポートは管理者またはSupervisorのみ利用できます。");
            return;
        }
        if (!canViewStudentId) {
            toast.error("学籍番号の閲覧権限がありません。");
            return;
        }

        const scopeLabel = scope === "pa" ? "PA" : scope === "lighting" ? "照明" : "全体";
        const filtered =
            scope === "all"
                ? members
                : members.filter((member) => member.crew === (scope === "pa" ? "PA" : "Lighting"));
        const rows = filtered.map((member) => [
            member.realName ?? member.name ?? "",
            member.studentId ?? "",
        ]);
        downloadExcelFile(`名簿_${scopeLabel}`, ["本名", "学籍番号"], rows);
    };

    if (!canExport) {
        return null;
    }

    return (
        <>
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleExport("all")}
                    disabled={!canViewStudentId}
                >
                    <Download className="w-4 h-4" />
                    全体名簿（Excel .xlsx）
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleExport("pa")}
                    disabled={!canViewStudentId}
                >
                    <Download className="w-4 h-4" />
                    PA名簿（Excel .xlsx）
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleExport("lighting")}
                    disabled={!canViewStudentId}
                >
                    <Download className="w-4 h-4" />
                    照明名簿（Excel .xlsx）
                </Button>
            </div>
            {!canViewStudentId && (
                <p className="text-xs text-muted-foreground">
                    学籍番号の閲覧権限がありません。
                </p>
            )}
        </>
    );
}
