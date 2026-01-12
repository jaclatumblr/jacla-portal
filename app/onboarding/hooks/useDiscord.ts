import { useState } from "react";
import { toast } from "@/lib/toast";
import { useAuth } from "@/contexts/AuthContext";

export function useDiscord(
    initialDiscordId: string | null = null,
    initialDiscordUsername: string | null = null
) {
    const { session } = useAuth();
    const [discordId, setDiscordId] = useState<string | null>(initialDiscordId);
    const [discordUsername, setDiscordUsername] = useState<string>(initialDiscordUsername ?? "");
    const [discordConnecting, setDiscordConnecting] = useState(false);
    const [discordDisconnecting, setDiscordDisconnecting] = useState(false);

    // Sync state if initial values change (e.g. data fetch complete)
    const setDiscordState = (id: string | null, username: string | null) => {
        setDiscordId(id);
        setDiscordUsername(username ?? "");
    };

    const handleDiscordConnect = async (nextUrl: string) => {
        if (!session) return;
        setDiscordConnecting(true);
        try {
            const res = await fetch("/api/discord/connect", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ next: nextUrl }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                toast.error(data?.error ?? "Discord連携に失敗しました。");
                setDiscordConnecting(false);
                return;
            }

            const data = (await res.json().catch(() => null)) as { url?: string } | null;
            if (!data?.url) {
                toast.error("Discord連携に失敗しました。");
                setDiscordConnecting(false);
                return;
            }

            // Redirect to Discord OAuth
            window.location.href = data.url;
        } catch (err) {
            console.error(err);
            toast.error("Discord連携に失敗しました。");
            setDiscordConnecting(false);
        }
    };

    const handleDiscordDisconnect = async () => {
        if (!session) return;
        setDiscordDisconnecting(true);
        try {
            const res = await fetch("/api/discord/disconnect", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                toast.error(data?.error ?? "Discord連携の解除に失敗しました。");
                setDiscordDisconnecting(false);
                return;
            }

            setDiscordId(null);
            setDiscordUsername("");
            toast.success("Discord連携を解除しました。");
        } catch (err) {
            console.error(err);
            toast.error("Discord連携の解除に失敗しました。");
        } finally {
            setDiscordDisconnecting(false);
        }
    };

    return {
        discordId,
        discordUsername,
        discordConnecting,
        discordDisconnecting,
        handleDiscordConnect,
        handleDiscordDisconnect,
        setDiscordState,
    };
}
