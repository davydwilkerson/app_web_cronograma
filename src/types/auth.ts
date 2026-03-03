import { DefaultSession } from "next-auth";

// Extender tipos do NextAuth para incluir role e id
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role?: string;
        } & DefaultSession["user"];
    }

    interface User {
        id: string;
        role?: string;
    }
}

export interface AuthUser {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string;
    role: "user" | "admin" | "superadmin" | string;
}

export interface AccessEvaluation {
    allowed: boolean;
    message: string;
    tone: "info" | "warn" | "error";
    role: "user" | "admin" | "superadmin" | string;
    isTrial: boolean;
    trialExpiresAt?: string;
}

// Modelos do SaaS
export interface AuthorizedAccess {
    id: string;
    userId: string;
    status: "active" | "pending" | "blocked";
    planType: "monthly" | "yearly" | "lifetime";
    expiresAt?: string;
}

export interface WeekContent {
    id: number;
    weekNum: number;
    title: string;
    cards: StudyCard[];
}

export interface StudyCard {
    id: string;
    title: string;
    discipline: string;
    isCompleted: boolean;
}
