/**
 * Tipos para conteúdo das semanas
 */

export interface WeekContent {
    id: number;
    week_num: number;
    day_num: number;
    card_order: number;
    card_id: string;
    discipline: Discipline;
    title: string;
    links: CardLink[];
    progress_items: ProgressItemDef[];
}

export type Discipline =
    | "portugues"
    | "especifica1"
    | "especifica2"
    | "rlm"
    | "sus1"
    | "sus2"
    | "revisao"
    | "simulado";

export interface CardLink {
    type: "video" | "pdf" | "exercise" | "exam" | "material" | "law" | "info";
    label: string;
    url: string;
    isPrimary: boolean;
}

export interface ProgressItemDef {
    key: string;         // "teoria", "revisao", "exercicios", "ativo", "simulado"
    label: string;       // Label para exibir
}

export interface UserProgress {
    id: string;
    user_id: string;
    week_num: number;
    card_id: string;
    is_completed: boolean;
    progress_data: Record<string, number>;  // { "teoria": 80, "revisao": 100, ... }
    xp_earned: number;
    updated_at: string;
}

export interface WeekSummary {
    week_num: number;
    total_cards: number;
    completed_cards: number;
    percentage: number;
}

export const DISCIPLINE_CONFIG: Record<
    Discipline,
    { label: string; color: string; icon: string }
> = {
    portugues: { label: "Português", color: "#3b82f6", icon: "fa-font" },
    especifica1: {
        label: "Específica 1",
        color: "#8b5cf6",
        icon: "fa-heartbeat",
    },
    especifica2: {
        label: "Específica 2",
        color: "#ec4899",
        icon: "fa-user-nurse",
    },
    rlm: { label: "RLM", color: "#f59e0b", icon: "fa-brain" },
    sus1: { label: "SUS 1", color: "#10b981", icon: "fa-hospital" },
    sus2: { label: "SUS 2", color: "#14b8a6", icon: "fa-notes-medical" },
    revisao: { label: "Revisão", color: "#6366f1", icon: "fa-book" },
    simulado: { label: "Simulado", color: "#ef4444", icon: "fa-file-alt" },
};

export const TOTAL_WEEKS = 24;

export const XP_CONFIG = {
    PER_CARD_COMPLETE: 10,
    PER_PROGRESS_100: 5,
    PER_WEEK_COMPLETE: 50,
    LEVELS: [
        { level: 1, title: "Iniciante", xpRequired: 0 },
        { level: 2, title: "Estudante", xpRequired: 100 },
        { level: 3, title: "Dedicado", xpRequired: 250 },
        { level: 4, title: "Avançado", xpRequired: 500 },
        { level: 5, title: "Experiente", xpRequired: 800 },
        { level: 6, title: "Mestre", xpRequired: 1200 },
        { level: 7, title: "Lenda", xpRequired: 1800 },
        { level: 8, title: "Aprovado!", xpRequired: 2500 },
    ],
};
