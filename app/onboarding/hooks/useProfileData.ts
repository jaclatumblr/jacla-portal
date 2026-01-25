import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { useAuth } from "@/contexts/AuthContext";

export const crewOptions = ["User", "PA", "Lighting"];
export const partOptions = [
    "Gt.", "A.Gt.", "C.Gt.", "Ba.", "Dr.", "Key.", "Syn.", "Acc.", "W.Syn.",
    "S.Sax.", "A.Sax.", "T.Sax.", "B.Sax.", "Tp.", "Tb.", "Tu.", "Hr.", "Eup.",
    "Cl.", "B.Cl.", "Ob.", "Fl.", "Vn.", "Va.", "Vc.", "Per.", "etc",
];

type ProfileRow = {
    display_name: string | null;
    avatar_url?: string | null;
    real_name: string | null;
    crew: string | null;
    part: string | null;
    leader: string | null;
    discord_username: string | null;
    discord_id?: string | null;
};

type ProfilePartRow = {
    part: string;
    is_primary: boolean;
};

type ProfilePrivateRow = {
    student_id: string | null;
    enrollment_year: number | null;
    birth_date: string | null;
};

export function useProfileData() {
    const { session } = useAuth();
    const [loading, setLoading] = useState(true);

    // Basic Info
    const [displayName, setDisplayName] = useState("");
    const [realName, setRealName] = useState("");
    const [avatarInitialUrl, setAvatarInitialUrl] = useState<string | null>(null);

    // Private Info
    const [studentId, setStudentId] = useState("");
    const [enrollmentYear, setEnrollmentYear] = useState("");
    const [birthDate, setBirthDate] = useState("");

    // Role & Music Info
    const [crew, setCrew] = useState("User");
    const [part, setPart] = useState("");
    const [subParts, setSubParts] = useState<string[]>([]);

    // Permissions
    const [isAdminLeader, setIsAdminLeader] = useState(false);
    const [canEditCrew, setCanEditCrew] = useState(false);

    // External
    const [discordInitialId, setDiscordInitialId] = useState<string | null>(null);
    const [discordInitialUsername, setDiscordInitialUsername] = useState<string | null>(null);

    // Data Fetching
    useEffect(() => {
        if (!session) return;
        let cancelled = false;

        (async () => {
            setLoading(true);

            // 1. Fetch main profile
            const { data, error } = await supabase
                .from("profiles")
                .select("display_name, real_name, crew, part, leader, discord_username, discord_id, avatar_url")
                .eq("id", session.user.id)
                .maybeSingle();

            if (cancelled) return;

            let profile = data as ProfileRow | null;

            // Create profile if not exists
            if (error || !profile) {
                const avatarCandidate =
                    session.user.user_metadata?.avatar_url ||
                    session.user.user_metadata?.picture ||
                    null;
                const { data: inserted, error: insertError } = await supabase
                    .from("profiles")
                    .insert({
                        id: session.user.id,
                        email: session.user.email,
                        display_name: session.user.user_metadata.full_name ?? session.user.email ?? "",
                        avatar_url: avatarCandidate,
                    })
                    .select("display_name, real_name, crew, part, leader, discord_username, discord_id, avatar_url")
                    .maybeSingle();

                if (insertError) {
                    console.error(insertError);
                    toast.error("プロフィールの取得に失敗しました。");
                    setLoading(false);
                    return;
                }
                profile = inserted as ProfileRow;
            }

            // 2. Fetch related tables
            const [partsRes, leadersRes, privateRes] = await Promise.all([
                supabase
                    .from("profile_parts")
                    .select("part, is_primary")
                    .eq("profile_id", session.user.id),
                supabase
                    .from("profile_leaders")
                    .select("leader")
                    .eq("profile_id", session.user.id),
                supabase
                    .from("profile_private")
                    .select("student_id, enrollment_year, birth_date")
                    .eq("profile_id", session.user.id)
                    .maybeSingle(),
            ]);

            if (partsRes.error) console.error(partsRes.error);
            if (leadersRes.error) console.error(leadersRes.error);
            if (privateRes.error) console.error(privateRes.error);

            // 3. Set State
            const parts = (partsRes.data ?? []) as ProfilePartRow[];
            const primaryPart = parts.find((row) => row.is_primary)?.part ?? (profile.part && profile.part !== "none" ? profile.part : "");
            const subs = parts.filter((row) => !row.is_primary).map((row) => row.part).filter((val) => val && val !== primaryPart);

            // Leaders check
            const leaderValues = (leadersRes.data ?? []).map((row: { leader: string }) => row.leader).filter((r: string) => r && r !== "none");
            const fallbackLeaders = profile.leader !== "none" && profile.leader ? [profile.leader] : [];
            const effectiveLeaders = leaderValues.length > 0 ? leaderValues : fallbackLeaders;
            const isAdmin = effectiveLeaders.includes("Administrator");

            // Set values
            setDisplayName(profile.display_name ?? "");
            setRealName(profile.real_name ?? "");
            setAvatarInitialUrl(profile.avatar_url ?? null);

            setCrew(profile.crew ?? "User");
            setPart(primaryPart ?? "");
            setSubParts(subs);

            // Private data
            const privateData = privateRes.data as ProfilePrivateRow | null;
            setStudentId(privateData?.student_id ?? "");
            setEnrollmentYear(privateData?.enrollment_year?.toString() ?? "");
            setBirthDate(privateData?.birth_date ?? "");

            setDiscordInitialId(profile.discord_id ?? null);
            setDiscordInitialUsername(profile.discord_username ?? null);

            setIsAdminLeader(isAdmin);
            setCanEditCrew(true); // Logic simplified as per original code

            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [session]);

    const toggleSubPart = (value: string) => {
        setSubParts((prev) =>
            prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
        );
    };

    return {
        loading,
        displayName, setDisplayName,
        realName, setRealName,
        avatarInitialUrl,
        studentId, setStudentId,
        enrollmentYear, setEnrollmentYear,
        birthDate, setBirthDate,
        crew, setCrew,
        part, setPart,
        subParts, toggleSubPart,
        isAdminLeader,
        canEditCrew,
        discordInitialId,
        discordInitialUsername,
    };
}
