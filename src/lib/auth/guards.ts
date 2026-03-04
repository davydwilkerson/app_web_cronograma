import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthUser, AccessEvaluation } from "@/types/auth";

export async function requireAuth(): Promise<AuthUser> {
    const session = await auth();

    if (!session?.user?.email) {
        redirect("/login");
    }

    return {
        id: session.user.id || "",
        email: session.user.email,
        displayName: session.user.name || "Usuário",
        avatarUrl: session.user.image || "/assets/avatar-nurse-trophy.svg",
        role: session.user.role || "user",
    };
}

export async function getAuthUser(): Promise<AuthUser | null> {
    const session = await auth();

    if (!session?.user?.email) {
        return null;
    }

    return {
        id: session.user.id || "",
        email: session.user.email,
        displayName: session.user.name || "Usuário",
        avatarUrl: session.user.image || "/assets/avatar-nurse-trophy.svg",
        role: session.user.role || "user",
    };
}

export async function evaluateAccess(userId: string, email: string): Promise<AccessEvaluation> {
    const accessRow = await prisma.authorizedAccess.findUnique({
        where: { email },
    });

    const role = "user";

    if (!accessRow) {
        const trialRow = await prisma.trialUsage.findUnique({
            where: { userId },
        });

        if (trialRow && trialRow.expiresAt > new Date() && trialRow.isActive) {
            return {
                allowed: true,
                message: "",
                tone: "info",
                role: "user",
                isTrial: true,
                trialExpiresAt: trialRow.expiresAt.toISOString(),
            };
        }

        return {
            allowed: false,
            message: "Não encontramos acesso ativo para este e-mail. Use o mesmo e-mail da compra.",
            tone: "warn",
            role: "user",
            isTrial: false,
        };
    }

    if (["active", "approved", "paid"].includes(accessRow.status)) {
        return {
            allowed: true,
            message: "",
            tone: "info",
            role,
            isTrial: false,
        };
    }

    if (["blocked", "canceled", "refunded"].includes(accessRow.status)) {
        return {
            allowed: false,
            message: accessRow.blockReason || "Acesso bloqueado.",
            tone: "error",
            role,
            isTrial: false,
        };
    }

    return {
        allowed: true,
        message: "",
        tone: "info",
        role,
        isTrial: false,
    };
}

