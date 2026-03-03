import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

const ACTIVE_STATUSES = new Set(["active", "approved", "paid"]);

function formatDateTime(value: Date | null): string {
    if (!value) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(value);
}

export const metadata = {
    title: "Admin - Cronograma",
    description: "Painel operacional de acessos e usuarios.",
};

export default async function AdminPage() {
    const user = await requireAuth();
    if (user.role !== "admin" && user.role !== "superadmin") {
        redirect("/dashboard");
    }

    const [totalUsers, activeAccess, blockedAccess, activeTrials, recentAccess] =
        await Promise.all([
            prisma.user.count(),
            prisma.authorizedAccess.count({
                where: {
                    status: { in: Array.from(ACTIVE_STATUSES) },
                },
            }),
            prisma.authorizedAccess.count({
                where: {
                    status: { in: ["blocked", "canceled", "refunded"] },
                },
            }),
            prisma.trialUsage.count({
                where: {
                    isActive: true,
                    expiresAt: { gt: new Date() },
                },
            }),
            prisma.authorizedAccess.findMany({
                orderBy: { updatedAt: "desc" },
                take: 100,
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            }),
        ]);

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div>
                    <p className={styles.kicker}>Painel Admin</p>
                    <h1>Operacao de acessos</h1>
                    <p>Resumo de usuarios, acessos pagos e status de trial.</p>
                </div>
                <Link href="/dashboard" className="btn btn-secondary">
                    Voltar ao dashboard
                </Link>
            </section>

            <section className={styles.statsGrid}>
                <article className={styles.statCard}>
                    <span>Usuarios</span>
                    <strong>{totalUsers}</strong>
                </article>
                <article className={styles.statCard}>
                    <span>Acessos ativos</span>
                    <strong>{activeAccess}</strong>
                </article>
                <article className={styles.statCard}>
                    <span>Acessos bloqueados</span>
                    <strong>{blockedAccess}</strong>
                </article>
                <article className={styles.statCard}>
                    <span>Trials ativos</span>
                    <strong>{activeTrials}</strong>
                </article>
            </section>

            <section className={styles.listSection}>
                <div className={styles.sectionHead}>
                    <h2>Ultimos acessos sincronizados</h2>
                    <span>{recentAccess.length} registros</span>
                </div>

                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Plano</th>
                                <th>Atualizado em</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentAccess.map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        <div className={styles.emailCell}>
                                            <strong>{row.email}</strong>
                                            <span>{row.user?.name || row.user?.email || "-"}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span
                                            className={`${styles.statusBadge} ${
                                                ACTIVE_STATUSES.has(row.status)
                                                    ? styles.statusActive
                                                    : styles.statusBlocked
                                            }`}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                    <td>{row.planType || "-"}</td>
                                    <td>{formatDateTime(row.updatedAt)}</td>
                                </tr>
                            ))}

                            {recentAccess.length === 0 && (
                                <tr>
                                    <td colSpan={4} className={styles.emptyRow}>
                                        Nenhum registro em authorized_access.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
