import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { evaluateAccess, requireAuth } from "@/lib/auth/guards";
import { getGamificationSnapshot } from "@/lib/gamification";
import { TOTAL_WEEKS } from "@/types/content";
import type {
    WeekCardData,
    WeekCardLink,
    WeekDayData,
    WeekProgressItem,
    WeekProgressState,
} from "@/types/week-study";
import WeekStudyClient from "@/components/dashboard/WeekStudyClient";
import styles from "./page.module.css";

interface WeekPageParams {
    weekNum: string;
}

interface WeekPageProps {
    params: Promise<WeekPageParams>;
}

function parseWeekNum(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > TOTAL_WEEKS) {
        return 0;
    }
    return parsed;
}

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

function normalizeLinks(input: unknown): WeekCardLink[] {
    if (!Array.isArray(input)) {
        return [];
    }

    const normalized: WeekCardLink[] = [];
    for (const item of input) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const type = typeof row.type === "string" ? row.type : "info";
        const label = typeof row.label === "string" ? row.label : "";
        if (!label) continue;

        normalized.push({
            type:
                type === "video" ||
                type === "pdf" ||
                type === "exercise" ||
                type === "exam" ||
                type === "material" ||
                type === "law"
                    ? type
                    : "info",
            label,
            url: typeof row.url === "string" ? row.url : "",
            isPrimary: Boolean(row.isPrimary),
        });
    }
    return normalized;
}

function normalizeProgressItems(input: unknown): WeekProgressItem[] {
    if (!Array.isArray(input)) {
        return [];
    }

    const normalized: WeekProgressItem[] = [];
    for (const item of input) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const key = typeof row.key === "string" ? row.key : "";
        const label = typeof row.label === "string" ? row.label : "";
        if (!key || !label) continue;
        normalized.push({ key, label });
    }

    return normalized;
}

export async function generateMetadata({ params }: WeekPageProps) {
    const resolved = await params;
    const weekNum = parseWeekNum(resolved.weekNum);
    if (!weekNum) {
        return { title: "Semana Inválida - Cronograma" };
    }
    return {
        title: `Semana ${weekNum} - Cronograma`,
        description: `Conteúdo de estudo da Semana ${weekNum}.`,
    };
}

export default async function WeekDetailPage({ params }: WeekPageProps) {
    const resolved = await params;
    const weekNum = parseWeekNum(resolved.weekNum);
    if (!weekNum) {
        notFound();
    }

    const user = await requireAuth();
    const access = await evaluateAccess(user.id, user.email);
    if (!access.allowed) {
        redirect("/login?error=no_access");
    }

    const trialMaxWeek = Number.parseInt(process.env.TRIAL_MAX_WEEK || "1", 10);
    if (access.isTrial && weekNum > trialMaxWeek) {
        redirect("/dashboard?error=trial_locked");
    }

    const [rows, progressRows, gamification] = await Promise.all([
        prisma.weekContent.findMany({
            where: { weekNum },
            orderBy: [{ dayNum: "asc" }, { cardOrder: "asc" }],
            select: {
                dayNum: true,
                cardId: true,
                discipline: true,
                title: true,
                links: true,
                progressItems: true,
            },
        }),
        prisma.userProgress.findMany({
            where: {
                userId: user.id,
                weekNum,
            },
            select: {
                cardId: true,
                isCompleted: true,
                progressData: true,
            },
        }),
        getGamificationSnapshot({
            userId: user.id,
            currentWeek: weekNum,
        }),
    ]);

    const daysByNumber = new Map<number, WeekDayData>();
    for (const row of rows) {
        const card: WeekCardData = {
            cardId: row.cardId,
            discipline: row.discipline,
            title: row.title,
            links: normalizeLinks(row.links),
            progressItems: normalizeProgressItems(row.progressItems),
        };

        if (!daysByNumber.has(row.dayNum)) {
            daysByNumber.set(row.dayNum, {
                dayNum: row.dayNum,
                cards: [],
            });
        }
        daysByNumber.get(row.dayNum)?.cards.push(card);
    }

    const days = Array.from(daysByNumber.values()).sort((a, b) => a.dayNum - b.dayNum);

    const initialProgress: Record<string, WeekProgressState> = {};
    for (const row of progressRows) {
        initialProgress[row.cardId] = {
            isCompleted: row.isCompleted,
            progressData: normalizeProgressData(row.progressData),
        };
    }

    return (
        <div className={`container ${styles.page}`}>
            <section className={styles.hero}>
                <p className={styles.kicker}>Cronograma Semanal</p>
                <h1>Semana {weekNum}</h1>
                <p className={styles.subtitle}>
                    Estudo Organizado por Dia com Progresso Sincronizado.
                </p>
            </section>

            {days.length > 0 ? (
                <WeekStudyClient
                    weekNum={weekNum}
                    days={days}
                    initialProgress={initialProgress}
                    initialGamification={gamification}
                />
            ) : (
                <section className={styles.emptyState}>
                    <h2>Semana Sem Conteúdo</h2>
                    <p>
                        Ainda não existem cards desta semana na tabela{" "}
                        <code>week_content</code>.
                    </p>
                    <p>
                        Rode no servidor: <code>npm run content:import</code>
                    </p>
                </section>
            )}
        </div>
    );
}
