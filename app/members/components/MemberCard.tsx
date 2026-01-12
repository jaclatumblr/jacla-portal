"use client";

import { MessageCircle, Music } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Member } from "../types";
import { positionLabels, positionPriority } from "../types";

type MemberCardProps = {
    member: Member;
    index: number;
    subParts: string[];
    canViewStudentId: boolean;
    isAdministrator: boolean;
    discordFallbackFor: string | null;
    onDiscordClick: (memberId: string) => void;
};

function getDiscordAppUrl(id: string) {
    const encoded = encodeURIComponent(id);
    if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) {
        return `intent://discord.com/users/${encoded}#Intent;scheme=https;package=com.discord;end`;
    }
    return `discord://-/users/${encoded}`;
}

export function MemberCard({
    member,
    index,
    subParts,
    canViewStudentId,
    isAdministrator,
    discordFallbackFor,
    onDiscordClick,
}: MemberCardProps) {
    const isOfficialRole = member.positions.includes("Official");
    const isAdministratorRole = member.leaderRoles.includes("Administrator");
    const showAdminBadge = isAdministratorRole && !isOfficialRole;
    const hasPositionBadge = member.positions.some((value) => value !== "Official");

    const leaderDisplayRoles = member.leaderRoles.filter((role) => {
        if (role === "Administrator") return false;
        if (!hasPositionBadge) return true;
        return role !== "Supervisor" && role !== "PA Leader" && role !== "Lighting Leader";
    });

    const leaderLabel = leaderDisplayRoles.join(" / ");
    const crewLabel = member.crew ?? "User";
    const hideCrewByLeader =
        leaderDisplayRoles.includes("PA Leader") || leaderDisplayRoles.includes("Lighting Leader");

    const roleSegments: string[] = [];
    if (leaderLabel) roleSegments.push(leaderLabel);
    if (crewLabel !== "User" && !hideCrewByLeader) roleSegments.push(crewLabel);
    const roleLabel = roleSegments.length > 0 ? roleSegments.join(" / ") : "User";
    const showRoleBadge = roleLabel !== "User" || (!isAdministratorRole && !isOfficialRole);

    const positionLabel =
        member.positions.length > 0
            ? [...member.positions]
                .filter((value) => value !== "Official")
                .sort((a, b) => (positionPriority[a] ?? 99) - (positionPriority[b] ?? 99))
                .map((value) => positionLabels[value] ?? value)
                .join(" / ")
            : null;

    const partLabel = member.part ?? "未設定";
    const subPartsLabel = subParts.join(" / ");
    const discordLabel = member.discordName ?? "未連携";
    const discordLinks = member.discordId
        ? {
            app: getDiscordAppUrl(member.discordId),
            web: `https://discord.com/users/${encodeURIComponent(member.discordId)}`,
        }
        : null;
    const bandLabels = member.bands.length > 0 ? member.bands : ["所属バンドなし"];
    const initial = member.name.trim().charAt(0) || "?";

    return (
        <div className="group relative p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

            <div className="relative flex items-start gap-3 md:gap-4">
                <Avatar className="w-12 h-12 md:w-16 md:h-16 border-2 border-border shrink-0">
                    {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-base md:text-lg">
                        {initial}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground font-mono">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="font-bold text-base md:text-lg truncate">{member.name}</h3>
                        {isOfficialRole && (
                            <Badge
                                variant="outline"
                                className="text-xs border-primary/40 bg-primary/15 text-primary shadow-sm"
                            >
                                Official
                            </Badge>
                        )}
                        {showAdminBadge && (
                            <Badge
                                variant="outline"
                                className="text-xs border-[#aee6ff]/40 bg-[#aee6ff]/10 text-[#aee6ff]"
                            >
                                Administrator
                            </Badge>
                        )}
                        {positionLabel && (
                            <Badge variant="secondary" className="text-xs">
                                {positionLabel}
                            </Badge>
                        )}
                        {showRoleBadge && (
                            <Badge variant="outline" className="text-xs bg-transparent">
                                {roleLabel}
                            </Badge>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                        本名: {member.realName ?? "未設定"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                        入学年度: {member.enrollmentYear ?? "未登録"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                        誕生日: {member.birthDate ?? "未登録"}
                    </p>
                    {canViewStudentId && (
                        <p className="text-xs text-muted-foreground truncate">
                            学籍番号: {member.studentId ?? "未登録"}
                        </p>
                    )}
                    {isAdministrator && (
                        <p className="text-xs text-muted-foreground truncate">
                            {member.email ?? "メール未登録"}
                        </p>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                        <Music className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm text-muted-foreground">{partLabel}</span>
                    </div>
                    {subPartsLabel && (
                        <p className="text-xs text-muted-foreground mb-3">サブ: {subPartsLabel}</p>
                    )}

                    <div className="space-y-1 mb-3 md:mb-4 text-xs md:text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <MessageCircle className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                                {discordLinks ? (
                                    <a
                                        href={discordLinks.app}
                                        onClick={() => onDiscordClick(member.id)}
                                        className="truncate text-primary hover:underline"
                                    >
                                        Discord: {discordLabel}
                                    </a>
                                ) : (
                                    <span className="truncate">Discord: {discordLabel}</span>
                                )}
                                {discordLinks && discordFallbackFor === member.id && (
                                    <div className="text-xs text-muted-foreground">
                                        開かない場合は
                                        <a
                                            href={discordLinks.web}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="ml-1 text-primary hover:underline"
                                        >
                                            Web版
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1 md:gap-2">
                        {bandLabels.map((band) => (
                            <Badge key={band} variant="outline" className="bg-transparent text-xs">
                                {band}
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
