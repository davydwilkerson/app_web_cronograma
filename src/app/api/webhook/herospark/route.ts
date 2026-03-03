import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const webhookSecret = process.env.HEROSPARK_WEBHOOK_SECRET;
        if (webhookSecret) {
            const authHeader = request.headers.get("authorization");
            const headerToken = request.headers.get("x-webhook-secret");
            const token = authHeader?.replace("Bearer ", "") || headerToken;

            if (token !== webhookSecret) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const body = await request.json();
        console.log("Webhook HeroSpark:", body);

        const email = (
            body.buyer?.email ||
            body.subscriber?.email ||
            body.email ||
            ""
        )
            .trim()
            .toLowerCase();

        if (!email) {
            return NextResponse.json({ error: "No email provided" }, { status: 400 });
        }

        const event = (body.event || body.status || "").toLowerCase().replace(/\s+/g, "_");

        // Status Logic
        let status = "pending";
        if (event.includes("approved") || event.includes("complete") || event.includes("paid") || event.includes("active")) {
            status = "active";
        } else if (event.includes("cancel") || event.includes("refund") || event.includes("chargeback") || event.includes("block")) {
            status = "blocked";
        }

        // Upsert User (Create placeholder if not exists)
        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                name: body.buyer?.name || "Aluno Novo",
                role: "user",
            },
        });

        // Upsert AuthorizedAccess
        await prisma.authorizedAccess.upsert({
            where: { email },
            update: {
                status,
                rawStatus: event,
                blockReason: status === "blocked" ? event : null,
                lastPaymentDate: new Date(),
            },
            create: {
                userId: user.id,
                email,
                status,
                rawStatus: event,
                blockReason: status === "blocked" ? event : null,
                planType: "monthly", // Default, pode vir do webhook
            },
        });

        return NextResponse.json({ success: true, email, status });
    } catch (error) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
