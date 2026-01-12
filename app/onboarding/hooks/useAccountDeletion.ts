import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { supabase, safeSignOut } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export function useAccountDeletion() {
    const { session } = useAuth();
    const router = useRouter();
    const [deleting, setDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        if (!session) return;
        const confirmed = window.confirm("アカウントを削除します。よろしいですか？");
        if (!confirmed) return;
        const confirmedTwice = window.confirm("この操作は取り消せません。本当に削除しますか？");
        if (!confirmedTwice) return;

        setDeleting(true);

        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) console.error(sessionError);

            const accessToken = sessionData.session?.access_token ?? session.access_token;
            if (!accessToken) {
                toast.error("セッションが切れました。再ログインしてください。");
                setDeleting(false);
                return;
            }

            const res = await fetch("/api/account/delete", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({}),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                toast.error(data?.error ?? "アカウントの削除に失敗しました。");
                setDeleting(false);
                return;
            }

            await safeSignOut();
            router.replace("/login");
        } catch (err) {
            console.error(err);
            toast.error("アカウントの削除に失敗しました。");
            setDeleting(false);
        }
    };

    return { deleting, handleDeleteAccount };
}
