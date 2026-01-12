import { NextResponse } from "next/server";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

export async function GET() {
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
        return NextResponse.json(
            { error: "Vercel credentials not configured" },
            { status: 500 }
        );
    }

    try {
        const response = await fetch(
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

        const data = await response.json();

        const deployments = (data.deployments ?? []).map((d: any) => ({
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
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
