import { NextRequest, NextResponse } from "next/server";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

export async function GET(request: NextRequest) {
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
        return NextResponse.json(
            { error: "Vercel credentials not configured" },
            { status: 500 }
        );
    }

    const searchParams = request.nextUrl.searchParams;
    const deploymentId = searchParams.get("deploymentId");
    const since = searchParams.get("since");

    if (!deploymentId) {
        return NextResponse.json(
            { error: "deploymentId is required" },
            { status: 400 }
        );
    }

    try {
        let url = `https://api.vercel.com/v2/deployments/${deploymentId}/events?builds=0&limit=100`;
        if (since) {
            url += `&since=${since}`;
        }

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${VERCEL_TOKEN}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Vercel Logs API error:", errorText);
            return NextResponse.json(
                { error: "Failed to fetch logs" },
                { status: response.status }
            );
        }

        const events = await response.json();

        // Filter and format runtime logs
        const logs = (events ?? [])
            .filter((e: any) => e.type === "stdout" || e.type === "stderr" || e.type === "request")
            .map((e: any) => ({
                id: e.id ?? `${e.date}-${Math.random()}`,
                type: e.type,
                text: e.text ?? e.payload?.text ?? formatRequestEvent(e),
                date: e.date,
                requestId: e.payload?.requestId,
                statusCode: e.payload?.statusCode,
                path: e.payload?.path,
            }));

        return NextResponse.json({ logs });
    } catch (error) {
        console.error("Error fetching logs:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

function formatRequestEvent(event: any): string {
    if (event.type === "request" && event.payload) {
        const { method, path, statusCode, duration } = event.payload;
        return `${method ?? "GET"} ${path ?? "/"} → ${statusCode ?? "?"} (${duration ?? "?"}ms)`;
    }
    return JSON.stringify(event.payload ?? event);
}
