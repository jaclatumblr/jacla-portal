"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth();
    return <AccountQueries key={session?.user.id ?? "anonymous"}>{children}</AccountQueries>;
}

function AccountQueries({ children }: { children: ReactNode }) {
    const [queryClient] = useState(createQueryClient);
    useEffect(() => () => { queryClient.clear(); }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
