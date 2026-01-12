import { useRef } from "react";
import { Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatar } from "../hooks/useAvatar";
import { cn } from "@/lib/utils";

type AvatarUploaderProps = {
    displayName: string;
    avatarHook: ReturnType<typeof useAvatar>; // Use the return type of the hook
};

export function AvatarUploader({ displayName, avatarHook }: AvatarUploaderProps) {
    const {
        avatarPreview,
        avatarUploading,
        handleAvatarChange,
        maxAvatarSizeMb,
    } = avatarHook;

    const inputRef = useRef<HTMLInputElement>(null);

    const handleContainerClick = () => {
        if (!avatarUploading) {
            inputRef.current?.click();
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                {/* Avatar Preview Circle */}
                <div
                    className="relative group cursor-pointer"
                    onClick={handleContainerClick}
                >
                    <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-background shadow-xl ring-2 ring-border transition-all group-hover:ring-primary/50">
                        {avatarPreview && (
                            <AvatarImage
                                src={avatarPreview}
                                alt={displayName || "avatar"}
                                className="object-cover"
                            />
                        )}
                        <AvatarFallback className="bg-secondary/20 text-secondary-foreground text-3xl font-bold">
                            {(displayName || "?").trim().charAt(0)}
                        </AvatarFallback>
                    </Avatar>

                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="w-8 h-8 text-white" />
                    </div>

                    {avatarUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1 space-y-3 text-center sm:text-left">
                    <div>
                        <h3 className="font-medium text-foreground">プロフィール画像</h3>
                        <p className="text-sm text-muted-foreground">
                            アイコンとして表示されます。
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div
                            onClick={handleContainerClick}
                            className={cn(
                                "inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-sm font-medium shadow-sm",
                                avatarUploading && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <ImageIcon className="h-4 w-4" />
                            画像を選択
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                            disabled={avatarUploading}
                            className="hidden"
                        />
                        <p className="text-xs text-muted-foreground">
                            推奨: 500x500px 以上 <br className="sm:hidden" />
                            (JPG, PNG, WEBP / Max {maxAvatarSizeMb}MB)
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
