import { redirect } from "next/navigation";
import { requireAuth, evaluateAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getGamificationSnapshot } from "@/lib/gamification";
import { DISCIPLINE_CONFIG, TOTAL_WEEKS } from "@/types/content";
import WeekGrid from "@/components/dashboard/WeekGrid";
import TrialBanner from "@/components/dashboard/TrialBanner";
import GamificationPanel from "@/components/dashboard/GamificationPanel";
import SmartStudyPlanner from "@/components/dashboard/SmartStudyPlanner";
import styles from "./page.module.css";

export const metadata = {
    title: "Cronograma — Enfermeiro Aprovado",
    description: "Seu cronograma de estudos de 24 semanas.",
};

export default async function DashboardPage() {
    const user = await requireAuth();
    const access = await evaluateAccess(user.id, user.email);

    if (!access.allowed) {
        const params = new URLSearchParams();
        params.set("error", access.tone === "error" ? "blocked" : "no_access");
        if (access.message.toLowerCase().includes("pagamento")) {
            params.set("reason", "payment");
        }
        redirect(`/login?${params.toString()}`);
    }

    const [progressRows, weekCards] = await Promise.all([
        prisma.userProgress.findMany({
            where: { userId: user.id },
            select: {
                weekNum: true,
                cardId: true,
                isCompleted: true,
                xpEarned: true,
                updatedAt: true,
            },
        }),
        prisma.weekContent.findMany({
            select: {
                weekNum: true,
                cardId: true,
                discipline: true,
            },
        }),
    ]);

    const weekProgress: Record<number, { total: number; completed: number }> = {};
    const uniqueCards = new Map<string, { weekNum: number; cardId: string; discipline: string }>();

    weekCards.forEach((card) => {
        const key = `${card.weekNum}-${card.cardId}`;
        if (!uniqueCards.has(key)) {
            uniqueCards.set(key, {
                weekNum: card.weekNum,
                cardId: card.cardId,
                discipline: card.discipline,
            });
            if (!weekProgress[card.weekNum]) {
                weekProgress[card.weekNum] = { total: 0, completed: 0 };
            }
            weekProgress[card.weekNum].total++;
        }
    });

    progressRows.forEach((row) => {
        if (row.isCompleted) {
            if (!weekProgress[row.weekNum]) {
                weekProgress[row.weekNum] = { total: 0, completed: 0 };
            }
            weekProgress[row.weekNum].completed++;
        }
    });

    const completedCardSet = new Set<string>();
    progressRows.forEach((row) => {
        if (row.isCompleted) {
            completedCardSet.add(`${row.weekNum}-${row.cardId}`);
        }
    });

    const plannerMap = new Map<
        string,
        { key: string; label: string; totalCards: number; completedCards: number; remainingCards: number }
    >();

    uniqueCards.forEach((card) => {
        const key = card.discipline;
        const label = DISCIPLINE_CONFIG[key as keyof typeof DISCIPLINE_CONFIG]?.label || key;
        const existing = plannerMap.get(key) || {
            key,
            label,
            totalCards: 0,
            completedCards: 0,
            remainingCards: 0,
        };

        existing.totalCards += 1;
        if (completedCardSet.has(`${card.weekNum}-${card.cardId}`)) {
            existing.completedCards += 1;
        } else {
            existing.remainingCards += 1;
        }

        plannerMap.set(key, existing);
    });

    const plannerDisciplines = Array.from(plannerMap.values()).sort((a, b) => {
        if (b.remainingCards !== a.remainingCards) {
            return b.remainingCards - a.remainingCards;
        }
        return a.label.localeCompare(b.label, "pt-BR");
    });

    const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
        const num = i + 1;
        const progress = weekProgress[num] || { total: 0, completed: 0 };
        const percentage =
            progress.total > 0
                ? Math.round((progress.completed / progress.total) * 100)
                : 0;

        return {
            week_num: num,
            total_cards: progress.total,
            completed_cards: progress.completed,
            percentage,
            locked: access.isTrial && num > parseInt(process.env.TRIAL_MAX_WEEK || "1", 10),
        };
    });

    const totalCards = weeks.reduce((sum, week) => sum + week.total_cards, 0);
    const completedCards = weeks.reduce((sum, week) => sum + week.completed_cards, 0);
    const overallPercentage =
        totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

    const trialExpiresAtLabel =
        access.isTrial && access.trialExpiresAt
            ? new Intl.DateTimeFormat("pt-BR").format(new Date(access.trialExpiresAt))
            : "";
    const currentWeek =
        weeks.find((week) => !week.locked && week.percentage < 100 && week.total_cards > 0)
            ?.week_num ||
        weeks.find((week) => !week.locked)?.week_num ||
        1;
    const gamification = await getGamificationSnapshot({
        userId: user.id,
        currentWeek,
        progressRows,
        weekCards,
    });

    return (
        <div className="container">
            {access.isTrial && <TrialBanner expiresAtLabel={trialExpiresAtLabel} />}

            <section className={styles.welcomeSection}>
                <div className={styles.welcomeContent}>
                    <h1 className={styles.welcomeTitle}>
                        Olá, <span>{user.displayName.split(" ")[0]}</span> 👋
                    </h1>
                    <p className={styles.welcomeSubtitle}>
                        Continue estudando, você está no caminho certo!
                    </p>
                </div>

                <div className={styles.overallProgress}>
                    <div className={styles.progressLabel}>
                        <span>Progresso Geral</span>
                        <span className={styles.progressPct}>{overallPercentage}%</span>
                    </div>
                    <div className={styles.progressTrack}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${overallPercentage}%` }}
                        />
                    </div>
                    <p className={styles.progressDetail}>
                        {completedCards} de {totalCards} atividades concluídas
                    </p>
                </div>
            </section>

            <section className={styles.weekSection}>
                <h2 className={styles.sectionTitle}>
                    <i className="fas fa-calendar-alt"></i>
                    Semanas de Estudo
                </h2>
                <WeekGrid weeks={weeks} />
            </section>

            <section className={styles.plannerSection}>
                <SmartStudyPlanner
                    disciplines={plannerDisciplines}
                    storageKey={`smart-planner:${user.id}`}
                />
            </section>

            <section className={styles.gamificationSection}>
                <GamificationPanel snapshot={gamification} variant="full" />
            </section>
        </div>
    );
}
