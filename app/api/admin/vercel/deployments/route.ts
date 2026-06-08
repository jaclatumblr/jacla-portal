import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/adminApiAuth";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_FETCH_TIMEOUT_MS = 8_000;

type VercelDeploymentResponse = {
    deployments?: Array<{
        uid?: string;
        name?: string;
        url?: string;
        state?: string;
        target?: string;
        createdAt?: number;
    }>;
};

const fetchVercel = async (url: string, init: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VERCEL_FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, {
            ...init,
            cache: "no-store",
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

export async function GET(request: Request) {
    const auth = await requireAdminApiAuth(request);
    if (!auth.authorized) {
        return auth.response;
    }

    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
        return NextResponse.json(
            { error: "Vercel credentials not configured" },
            { status: 500 }
        );
    }

    try {
        const response = await fetchVercel(
            `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=10`,
            {
                headers: {
                    Authorization: `Bearer ${VERCEL_TOKEN}`,
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Vercel API error:", errorText);
            return NextResponse.json(
                { error: "Failed to fetch deployments" },
                { status: response.status }
            );
        }

        const data = (await response.json()) as VercelDeploymentResponse;

        const deployments = (data.deployments ?? []).map((d) => ({
            id: d.uid,
            name: d.name,
            url: d.url,
            state: d.state,
            target: d.target,
            createdAt: d.createdAt,
        }));

        return NextResponse.json({ deployments });
    } catch (error) {
        console.error("Error fetching deployments:", error);
        if (error instanceof Error && error.name === "AbortError") {
            return NextResponse.json(
                { error: "Vercel request timed out" },
                { status: 504 }
            );
        }
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
