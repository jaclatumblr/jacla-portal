import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useDiscord } from "../hooks/useDiscord";
import { cn } from "@/lib/utils";

type DiscordConnectSectionProps = {
    discordHook: ReturnType<typeof useDiscord>;
    nextUrl: string;
};

export function DiscordConnectSection({ discordHook, nextUrl }: DiscordConnectSectionProps) {
    const {
        discordId,
        discordUsername,
        discordConnecting,
        discordDisconnecting,
        handleDiscordConnect,
        handleDiscordDisconnect,
    } = discordHook;

    return (
        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h3 className="font-medium flex items-center gap-2">
                        Discord連携
                        <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full border",
                            discordId
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : "bg-muted text-muted-foreground border-transparent"
                        )}>
                            {discordId ? "連携済み" : "未連携"}
                        </span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        部内の連絡用Discordサーバーとアカウントを紐付けます。
                    </p>
                </div>
            </div>

            {discordId ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold">
                            D
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">
                                {discordUsername || "Discord User"}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                                ID: {discordId}
                            </span>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDiscordDisconnect}
                        disabled={discordDisconnecting}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        {discordDisconnecting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            "解除"
                        )}
                    </Button>
                </div>
            ) : (
                <Button
                    type="button"
                    onClick={() => handleDiscordConnect(nextUrl)}
                    disabled={discordConnecting}
                    className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white"
                >
                    {discordConnecting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                        // Simple Discord Icon
                        <svg
                            className="w-5 h-5 mr-2"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" />
                        </svg>
                    )}
                    Discordと連携する
                </Button>
            )}
        </div>
    );
}
