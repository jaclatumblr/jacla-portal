"use client";

import { Badge } from "@/components/ui/badge";
import type { MaintenanceStatus } from "./types";

type StatusBadgeProps = {
    status: MaintenanceStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
    if (status === "ok") {
        return <Badge className="bg-emerald-600 text-white">OK</Badge>;
    }
    if (status === "needs_repair") {
        return <Badge className="bg-amber-500 text-black">要修理</Badge>;
    }
    if (status === "needs_replace") {
        return <Badge variant="destructive">要交換</Badge>;
    }
    if (status === "loaned") {
        return <Badge variant="secondary">貸出中</Badge>;
    }
    return (
        <Badge variant="outline" className="border-destructive text-destructive">
            欠品
        </Badge>
    );
}
