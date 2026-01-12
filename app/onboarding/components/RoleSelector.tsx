import { Music, Lightbulb, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { crewOptions } from "../hooks/useProfileData";

type RoleSelectorProps = {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
};

export function RoleSelector({ value, onChange, disabled }: RoleSelectorProps) {
    return (
        <div className="space-y-3">
            <span className="text-sm font-medium text-foreground">
                所属パート (Crew)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {crewOptions.map((option) => {
                    const isSelected = value === option;
                    const isPa = option === "PA";
                    const isLight = option === "Lighting";

                    return (
                        <button
                            key={option}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(option)}
                            className={cn(
                                "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200",
                                "hover:bg-accent/50",
                                isSelected
                                    ? isPa
                                        ? "border-blue-500 bg-blue-500/10 text-blue-500"
                                        : isLight
                                            ? "border-purple-500 bg-purple-500/10 text-purple-500"
                                            : "border-primary bg-primary/10 text-primary"
                                    : "border-border bg-card text-muted-foreground"
                            )}
                        >
                            {isPa ? (
                                <Music className="w-8 h-8 mb-2" />
                            ) : isLight ? (
                                <Lightbulb className="w-8 h-8 mb-2" />
                            ) : (
                                <User className="w-8 h-8 mb-2" />
                            )}
                            <span className="font-bold">{option}</span>
                            <span className="text-[10px] mt-1 opacity-80">
                                {isPa
                                    ? "音響・機材管理"
                                    : isLight
                                        ? "照明・演出"
                                        : "一般部員"}
                            </span>

                            {isSelected && (
                                <div
                                    className={cn(
                                        "absolute top-2 right-2 w-2 h-2 rounded-full",
                                        isPa ? "bg-blue-500" : isLight ? "bg-purple-500" : "bg-primary"
                                    )}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
