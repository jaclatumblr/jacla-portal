import { useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import { supabase } from "@/lib/supabaseClient";

const avatarTypes = ["image/png", "image/jpeg", "image/webp"];
const maxAvatarSizeMb = 2;
const maxAvatarDimension = 512;
const avatarOutputType = "image/webp";
const avatarOutputQuality = 0.82;

/* ------------------------------------------------------------------
   Helper: Load Image
------------------------------------------------------------------ */
const loadAvatarImage = (file: File): Promise<HTMLImageElement | ImageBitmap> => {
    if (typeof createImageBitmap === "function") {
        return createImageBitmap(file);
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };
        img.src = url;
    });
};

/* ------------------------------------------------------------------
   Helper: Compress Image
------------------------------------------------------------------ */
const compressAvatarImage = async (file: File): Promise<File> => {
    const image = await loadAvatarImage(file);
    const width = "naturalWidth" in image ? image.naturalWidth : image.width;
    const height = "naturalHeight" in image ? image.naturalHeight : image.height;
    const scale = Math.min(1, maxAvatarDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas not supported");
    }
    ctx.drawImage(image as CanvasImageSource, 0, 0, targetWidth, targetHeight);
    if ("close" in image) {
        image.close();
    }

    const toBlob = (type: string) =>
        new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, type, avatarOutputQuality);
        });

    let outputType = avatarOutputType;
    let blob = await toBlob(outputType);
    if (!blob) {
        outputType = file.type;
        blob = await toBlob(outputType);
    }
    if (!blob) {
        throw new Error("Failed to encode image");
    }

    const baseName = file.name.replace(/\.[^.]+$/, "");
    const extension =
        outputType === "image/jpeg" ? "jpg" : outputType === "image/png" ? "png" : "webp";
    return new File([blob], `${baseName || "avatar"}.${extension}`, { type: outputType });
};

/* ------------------------------------------------------------------
   Hook: useAvatar
------------------------------------------------------------------ */
export function useAvatar(initialUrl: string | null = null) {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUrl);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(initialUrl);
    const [avatarUploading, setAvatarUploading] = useState(false);

    // Update preview when initialUrl changes (e.g. data loaded)
    useEffect(() => {
        if (initialUrl) {
            setAvatarUrl(initialUrl);
            setAvatarPreview(initialUrl);
        }
    }, [initialUrl]);

    // Create/revoke object URL for preview
    useEffect(() => {
        if (!avatarFile) return;
        const url = URL.createObjectURL(avatarFile);
        setAvatarPreview(url);
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [avatarFile]);

    const handleAvatarChange = async (file: File | null) => {
        if (!file) {
            setAvatarFile(null);
            return;
        }
        if (!avatarTypes.includes(file.type)) {
            toast.error("PNG/JPG/WEBP の画像を選択してください。");
            return;
        }
        try {
            const compressed = await compressAvatarImage(file);
            if (compressed.size > maxAvatarSizeMb * 1024 * 1024) {
                toast.error(`画像サイズは ${maxAvatarSizeMb}MB 以下にしてください。`);
                setAvatarFile(null);
                return;
            }
            setAvatarFile(compressed);
        } catch (compressionError) {
            console.error(compressionError);
            toast.error("画像の処理に失敗しました。");
            setAvatarFile(null);
        }
    };

    const uploadAvatar = async (userId: string): Promise<string | null> => {
        if (!avatarFile) return avatarUrl;

        setAvatarUploading(true);
        try {
            const fileExt = avatarFile.name.split(".").pop() ?? "png";
            const safeName = avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const path = `${userId}/${Date.now()}-${safeName || `avatar.${fileExt}`}`;

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(path, avatarFile, { upsert: true });

            if (uploadError) {
                console.error(uploadError);
                toast.error("画像のアップロードに失敗しました。");
                setAvatarUploading(false);
                return null; // Failed
            }

            const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
            const newUrl = publicUrl.publicUrl;

            setAvatarUrl(newUrl);
            setAvatarPreview(newUrl);
            setAvatarFile(null);
            setAvatarUploading(false);

            return newUrl;
        } catch (err) {
            console.error(err);
            toast.error("画像のアップロード中にエラーが発生しました。");
            setAvatarUploading(false);
            return null;
        }
    };

    return {
        avatarUrl,
        avatarPreview,
        avatarFile,
        avatarUploading,
        handleAvatarChange,
        uploadAvatar,
        maxAvatarSizeMb,
    };
}
