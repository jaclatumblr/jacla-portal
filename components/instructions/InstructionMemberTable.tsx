import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { BandMemberDetail } from "@/app/types/instructions";
import { Badge } from "@/components/ui/badge";

type InstructionMemberTableProps = {
    members: BandMemberDetail[];
    role: "pa" | "lighting";
};

export function InstructionMemberTable({
    members,
    role,
}: InstructionMemberTableProps) {
    if (members.length === 0) {
        return (
            <p className="text-sm text-muted-foreground p-3 border rounded-md border-border/50 bg-muted/20">
                メンバー情報は未入力です。
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {/* Mobile View */}
            <div className="space-y-2 md:hidden">
                {members.map((member) => (
                    <div
                        key={member.id}
                        className="rounded-md border border-border bg-card/50 p-3 text-sm"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-base">
                                    {member.instrument || "Part"}
                                </span>
                                {member.isMc && <Badge variant="secondary" className="text-[10px] h-5">MC</Badge>}
                            </div>
                            <span className="text-muted-foreground text-xs">{member.name}</span>
                        </div>

                        {/* PAの場合のみ返し要望を詳細表示 */}
                        {role === "pa" && (
                            <div className="grid gap-2 text-xs border-t border-border/50 pt-2 mt-1">
                                <div className="grid grid-cols-[60px,1fr] gap-2">
                                    <span className="text-muted-foreground">返し要望</span>
                                    <span className="text-foreground font-medium whitespace-pre-wrap">
                                        {member.monitorRequest?.trim() || "-"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-[60px,1fr] gap-2">
                                    <span className="text-muted-foreground">備考</span>
                                    <span className="text-foreground whitespace-pre-wrap">
                                        {member.monitorNote?.trim() || "-"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto rounded-md border border-border bg-card/40">
                <Table className="min-w-[600px]">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[150px]">パート</TableHead>
                            <TableHead className="w-[180px]">名前</TableHead>
                            <TableHead className="w-[60px] text-center">MC</TableHead>
                            {role === "pa" && (
                                <>
                                    <TableHead className="w-[200px] text-blue-400">返し要望</TableHead>
                                    <TableHead className="w-[200px] text-blue-400">備考</TableHead>
                                </>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((member) => (
                            <TableRow key={member.id} className="hover:bg-muted/30">
                                <TableCell className="font-semibold">
                                    {member.instrument || "Part"}
                                </TableCell>
                                <TableCell>{member.name}</TableCell>
                                <TableCell className="text-center">
                                    {member.isMc ? "○" : "-"}
                                </TableCell>

                                {role === "pa" && (
                                    <>
                                        <TableCell className="text-sm whitespace-pre-wrap">
                                            {member.monitorRequest?.trim() || "-"}
                                        </TableCell>
                                        <TableCell className="text-sm whitespace-pre-wrap">
                                            {member.monitorNote?.trim() || "-"}
                                        </TableCell>
                                    </>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
