import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

const ACTIVE_STATUSES = new Set(["active", "approved", "paid"]);
const TRIAL_DAYS = 7;

function addDays(baseDate: Date, days: number): Date {
    return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

export const metadata = {
    title: "Teste Gratis - Cronograma",
    description: "Inicie seu periodo de teste e acesse o cronograma.",
};

export default async function TrialPage() {
    const session = await auth();
    const email = session?.user?.email || "";
    const userId = session?.user?.id || "";

    if (!email || !userId) {
        return (
            <div className={styles.page}>
                <section className={styles.card}>
                    <p className={styles.kicker}>Periodo de teste</p>
                    <h1>Ative seu acesso de 7 dias</h1>
                    <p>
                        Faça login primeiro para ativar o teste no seu usuario e liberar o
                        cronograma.
                    </p>
                    <div className={styles.actions}>
                        <Link href="/login?redirect=%2Ftrial" className="btn btn-primary">
                            Entrar para ativar trial
                        </Link>
                    </div>
                </section>
            </div>
        );
    }

    const accessRow = await prisma.authorizedAccess.findUnique({
        where: { email },
        select: { status: true },
    });

    if (accessRow && ACTIVE_STATUSES.has(accessRow.status)) {
        redirect("/dashboard");
    }

    const now = new Date();
    const trialRow = await prisma.trialUsage.findUnique({
        where: { userId },
        select: {
            id: true,
            expiresAt: true,
            isActive: true,
        },
    });

    if (!trialRow) {
        await prisma.trialUsage.create({
            data: {
                userId,
                expiresAt: addDays(now, TRIAL_DAYS),
                isActive: true,
            },
        });
        redirect("/dashboard?trial=started");
    }

    if (trialRow.isActive && trialRow.expiresAt > now) {
        redirect("/dashboard?trial=active");
    }

    return (
        <div className={styles.page}>
            <section className={styles.card}>
                <p className={styles.kicker}>Periodo de teste</p>
                <h1>Seu trial ja foi encerrado</h1>
                <p>
                    O periodo gratuito deste usuario terminou. Para continuar com acesso
                    completo, fale com o suporte.
                </p>
                <div className={styles.actions}>
                    <a
                        href="https://wa.me/5561992599325"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                    >
                        Falar no WhatsApp
                    </a>
                    <Link href="/dashboard" className="btn btn-secondary">
                        Voltar ao dashboard
                    </Link>
                </div>
            </section>
        </div>
    );
}
