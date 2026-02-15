import { Lightbulb, Music, User, type LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { crewOptions } from "../hooks/useProfileData";

type RoleSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type RoleMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  triggerClassName: string;
  panelClassName: string;
  iconClassName: string;
};

const roleMeta: Record<string, RoleMeta> = {
  User: {
    label: "User",
    description: "一般部員",
    icon: User,
    triggerClassName:
      "data-[state=active]:border-slate-200/70 data-[state=active]:bg-slate-200/25 data-[state=active]:text-white data-[state=active]:shadow-[0_0_0_1px_rgba(226,232,240,0.35),0_0_18px_rgba(226,232,240,0.2)] [&[data-state=active]_svg]:text-white",
    panelClassName: "border-slate-300/40 bg-slate-300/10",
    iconClassName: "text-muted-foreground",
  },
  PA: {
    label: "PA",
    description: "音響・機材管理",
    icon: Music,
    triggerClassName:
      "data-[state=active]:border-blue-300/80 data-[state=active]:bg-blue-400/25 data-[state=active]:text-blue-100 data-[state=active]:shadow-[0_0_0_1px_rgba(96,165,250,0.42),0_0_18px_rgba(59,130,246,0.35)] [&[data-state=active]_svg]:text-blue-100",
    panelClassName: "border-blue-300/45 bg-blue-400/12",
    iconClassName: "text-muted-foreground",
  },
  Lighting: {
    label: "Lighting",
    description: "照明・演出",
    icon: Lightbulb,
    triggerClassName:
      "data-[state=active]:border-amber-300/80 data-[state=active]:bg-amber-400/25 data-[state=active]:text-amber-100 data-[state=active]:shadow-[0_0_0_1px_rgba(252,211,77,0.4),0_0_18px_rgba(245,158,11,0.28)] [&[data-state=active]_svg]:text-amber-100",
    panelClassName: "border-amber-300/45 bg-amber-400/12",
    iconClassName: "text-muted-foreground",
  },
};

export function RoleSelector({ value, onChange, disabled }: RoleSelectorProps) {
  const selectedMeta = roleMeta[value] ?? roleMeta.User;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">役職</span>
        <span className="text-xs text-muted-foreground">選択中: {selectedMeta.label}</span>
      </div>

      <Tabs value={value} onValueChange={onChange} className="gap-2">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl border border-border/80 bg-muted/30 p-1">
          {crewOptions.map((option) => {
            const meta = roleMeta[option] ?? roleMeta.User;
            const Icon = meta.icon;

            return (
              <TabsTrigger
                key={option}
                value={option}
                disabled={disabled}
                className={cn(
                  "h-auto rounded-lg border border-border/30 bg-background/20 px-2 py-2.5 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:bg-background/40",
                  meta.triggerClassName,
                  disabled && "cursor-not-allowed opacity-60"
                )}
              >
                <Icon className={cn("h-4 w-4", meta.iconClassName)} />
                {meta.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {crewOptions.map((option) => {
          const meta = roleMeta[option] ?? roleMeta.User;
          const Icon = meta.icon;

          return (
            <TabsContent
              key={option}
              value={option}
              className={cn("rounded-lg border px-3 py-2", meta.panelClassName)}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className={cn("h-4 w-4", meta.iconClassName)} />
                <span className="font-medium text-foreground">{meta.label}</span>
                <span>/</span>
                <span>{meta.description}</span>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
