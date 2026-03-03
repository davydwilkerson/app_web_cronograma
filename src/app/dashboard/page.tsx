import { redirect } from "next/navigation";
import { requireAuth, evaluateAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { TOTAL_WEEKS } from "@/types/content";
import WeekGrid from "@/components/dashboard/WeekGrid";
import TrialBanner from "@/components/dashboard/TrialBanner";
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

    // Buscar progresso de todas as semanas
    const [progressRows, weekCards] = await Promise.all([
        prisma.userProgress.findMany({
            where: { userId: user.id },
            select: {
                weekNum: true,
                cardId: true,
                isCompleted: true,
            },
        }),
        prisma.weekContent.findMany({
            select: {
                weekNum: true,
                cardId: true,
            },
        }),
    ]);

    // Calcular progresso por semana
    const weekProgress: Record<number, { total: number; completed: number }> = {};

    // Contar cards por semana
    const uniqueCards = new Set<string>();
    weekCards.forEach((card) => {
        const key = `${card.weekNum}-${card.cardId}`;
        if (!uniqueCards.has(key)) {
            uniqueCards.add(key);
            if (!weekProgress[card.weekNum]) {
                weekProgress[card.weekNum] = { total: 0, completed: 0 };
            }
            weekProgress[card.weekNum].total++;
        }
    });

    // Contar completados
    progressRows.forEach((row) => {
        if (row.isCompleted) {
            if (!weekProgress[row.weekNum]) {
                weekProgress[row.weekNum] = { total: 0, completed: 0 };
            }
            weekProgress[row.weekNum].completed++;
        }
    });

    // Construir dados das semanas
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
            locked: access.isTrial && num > (parseInt(process.env.TRIAL_MAX_WEEK || "1", 10)),
        };
    });

    // Calcular progresso geral
    const totalCards = weeks.reduce((sum, w) => sum + w.total_cards, 0);
    const completedCards = weeks.reduce((sum, w) => sum + w.completed_cards, 0);
    const overallPercentage =
        totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

    const trialExpiresAtLabel =
        access.isTrial && access.trialExpiresAt
            ? new Intl.DateTimeFormat("pt-BR").format(new Date(access.trialExpiresAt))
            : "";

    return (
        <div className="container">
            {/* Trial Banner */}
            {access.isTrial && (
                <TrialBanner expiresAtLabel={trialExpiresAtLabel} />
            )}

            {/* Welcome Section */}
            <section className={styles.welcomeSection}>
                <div className={styles.welcomeContent}>
                    <h1 className={styles.welcomeTitle}>
                        Olá, <span>{user.displayName.split(" ")[0]}</span> 👋
                    </h1>
                    <p className={styles.welcomeSubtitle}>
                        Continue estudando, você está no caminho certo!
                    </p>
                </div>

                {/* Overall Progress */}
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

            {/* Week Grid */}
            <section className={styles.weekSection}>
                <h2 className={styles.sectionTitle}>
                    <i className="fas fa-calendar-alt"></i>
                    Semanas de Estudo
                </h2>
                <WeekGrid weeks={weeks} />
            </section>
        </div>
    );
}
