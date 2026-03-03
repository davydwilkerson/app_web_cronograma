export interface WeekCardLink {
    type: "video" | "pdf" | "exercise" | "exam" | "material" | "law" | "info";
    label: string;
    url: string;
    isPrimary: boolean;
}

export interface WeekProgressItem {
    key: string;
    label: string;
}

export interface WeekCardData {
    cardId: string;
    discipline: string;
    title: string;
    links: WeekCardLink[];
    progressItems: WeekProgressItem[];
}

export interface WeekDayData {
    dayNum: number;
    cards: WeekCardData[];
}

export interface WeekProgressState {
    isCompleted: boolean;
    progressData: Record<string, number>;
}
