import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGamificationSnapshot } from "@/lib/gamification";
import { calculateCardXp } from "@/lib/gamification-balance";
import { TOTAL_WEEKS } from "@/types/content";

const progressSchema = z.object({
    weekNum: z.number().int().min(1).max(TOTAL_WEEKS),
    cardId: z.string().trim().min(1).max(64),
    isCompleted: z.boolean().optional(),
    progressData: z.record(z.string(), z.number().min(0).max(100)).optional(),
});

function normalizeProgressData(input: unknown): Record<string, number> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return {};
    }

    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(input)) {
        if (typeof value !== "number" || Number.isNaN(value)) {
            continue;
        }
        normalized[key] = Math.max(0, Math.min(100, Math.round(value)));
    }
    return normalized;
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const json = await request.json();
        const parsed = progressSchema.safeParse(json);

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "Invalid payload",
                    details: parsed.error.issues.map((issue) => issue.message),
                },
                { status: 400 }
            );
        }

        const { weekNum, cardId, isCompleted, progressData } = parsed.data;

        const existing = await prisma.userProgress.findUnique({
            where: {
                userId_weekNum_cardId: {
                    userId,
                    weekNum,
                    cardId,
                },
            },
            select: {
                progressData: true,
                isCompleted: true,
                xpEarned: true,
            },
        });

        const existingProgress = normalizeProgressData(existing?.progressData);
        const incomingProgress = normalizeProgressData(progressData);
        const mergedProgress = {
            ...existingProgress,
            ...incomingProgress,
        };

        const hasProgress = Object.keys(mergedProgress).length > 0;
        const computedCompleted =
            hasProgress && Object.values(mergedProgress).every((value) => value >= 100);
        const nextIsCompleted = isCompleted ?? computedCompleted;
        const totalCardXp = calculateCardXp({
            progressData: mergedProgress,
            isCompleted: nextIsCompleted,
            isPerfect: computedCompleted,
        });
        const previousCardXp = existing?.xpEarned ?? 0;
        const xpDelta = totalCardXp - previousCardXp;

        const saved = await prisma.userProgress.upsert({
            where: {
                userId_weekNum_cardId: {
                    userId,
                    weekNum,
                    cardId,
                },
            },
            update: {
                progressData: mergedProgress,
                isCompleted: nextIsCompleted,
                xpEarned: totalCardXp,
            },
            create: {
                userId,
                weekNum,
                cardId,
                progressData: mergedProgress,
                isCompleted: nextIsCompleted,
                xpEarned: totalCardXp,
            },
            select: {
                weekNum: true,
                cardId: true,
                isCompleted: true,
                progressData: true,
                xpEarned: true,
                updatedAt: true,
            },
        });

        const gamification = await getGamificationSnapshot({
            userId,
            currentWeek: weekNum,
        });

        return NextResponse.json({
            success: true,
            xpDelta,
            progress: {
                weekNum: saved.weekNum,
                cardId: saved.cardId,
                isCompleted: saved.isCompleted,
                progressData: normalizeProgressData(saved.progressData),
                xpEarned: saved.xpEarned,
                updatedAt: saved.updatedAt.toISOString(),
            },
            gamification,
        });
    } catch (error) {
        console.error("Progress API error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
