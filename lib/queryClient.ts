"use client";

import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // SSRでは初期フェッチ後、即座にstaleにして再フェッチを防ぐ
                staleTime: 60 * 1000, // 1分間はfreshとみなす
                gcTime: 5 * 60 * 1000, // 5分間キャッシュを保持
                retry: 1, // 失敗時は1回だけリトライ
                refetchOnWindowFocus: false, // フォーカス時の自動再取得を無効化
            },
        },
    });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
    if (typeof window === "undefined") {
        // サーバー: 常に新しいQueryClientを作成
        return makeQueryClient();
    } else {
        // ブラウザ: シングルトンを使用
        if (!browserQueryClient) {
            browserQueryClient = makeQueryClient();
        }
        return browserQueryClient;
    }
}
