"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./SmartStudyPlanner.module.css";

type WeekdayKey =
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";

interface DisciplinePlanInput {
    key: string;
    label: string;
    totalCards: number;
    completedCards: number;
    remainingCards: number;
}

interface SmartStudyPlannerProps {
    disciplines: DisciplinePlanInput[];
    storageKey: string;
}

interface PlannerSettings {
    examDate: string;
    profile: PlannerProfile;
    scoringModel: ScoringModel;
    wrongPenalty: number;
    availabilityMinutes: Record<WeekdayKey, number>;
    weightByDiscipline: Record<string, number>;
}

interface PlannerWeightsSeed {
    key: string;
    remainingCards: number;
}

type PlannerProfile = "leve" | "padrao" | "hardcore";
type ScoringModel =
    | "discipline_weight"
    | "question_value"
    | "weighted_average"
    | "negative_marking";

const PROFILE_CONFIG: Record<
    PlannerProfile,
    {
        label: string;
        weightExponent: number;
        backlogFactor: number;
        urgencyFactor: number;
        riskMultiplier: number;
        description: string;
    }
> = {
    leve: {
        label: "Leve",
        weightExponent: 0.92,
        backlogFactor: 0.86,
        urgencyFactor: 0.9,
        riskMultiplier: 0.82,
        description: "Distribui carga de forma mais suave.",
    },
    padrao: {
        label: "Padrao",
        weightExponent: 1,
        backlogFactor: 1,
        urgencyFactor: 1,
        riskMultiplier: 1,
        description: "Equilibrio entre constancia e prioridade.",
    },
    hardcore: {
        label: "Hardcore",
        weightExponent: 1.2,
        backlogFactor: 1.24,
        urgencyFactor: 1.28,
        riskMultiplier: 1.34,
        description: "Concentracao forte nas materias criticas.",
    },
};

const SCORING_MODEL_CONFIG: Record<
    ScoringModel,
    {
        label: string;
        weightInputLabel: string;
        tableWeightLabel: string;
        formulaText: string;
    }
> = {
    discipline_weight: {
        label: "Peso por Disciplina",
        weightInputLabel: "Peso da Disciplina",
        tableWeightLabel: "Peso",
        formulaText:
            "Nota = acertos por disciplina x peso da disciplina.",
    },
    question_value: {
        label: "Valor por Questao",
        weightInputLabel: "Valor por Questao",
        tableWeightLabel: "Valor",
        formulaText:
            "Nota = quantidade de acertos x valor de cada questao.",
    },
    weighted_average: {
        label: "Media Ponderada",
        weightInputLabel: "Peso da Media",
        tableWeightLabel: "Peso",
        formulaText:
            "Nota final = soma(nota da disciplina x peso) / soma dos pesos.",
    },
    negative_marking: {
        label: "Com Penalidade",
        weightInputLabel: "Valor por Acerto",
        tableWeightLabel: "Valor",
        formulaText:
            "Nota = (certas x valor) - (erradas x penalidade).",
    },
};

const WEEKDAY_ORDER: Array<{ key: WeekdayKey; label: string }> = [
    { key: "monday", label: "Segunda" },
    { key: "tuesday", label: "Terca" },
    { key: "wednesday", label: "Quarta" },
    { key: "thursday", label: "Quinta" },
    { key: "friday", label: "Sexta" },
    { key: "saturday", label: "Sabado" },
    { key: "sunday", label: "Domingo" },
];

const JS_DAY_TO_KEY: Record<number, WeekdayKey> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
};

const DEFAULT_AVAILABILITY: Record<WeekdayKey, number> = {
    monday: 120,
    tuesday: 120,
    wednesday: 120,
    thursday: 120,
    friday: 120,
    saturday: 180,
    sunday: 120,
};

function toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function buildDefaultExamDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 120);
    return toDateInputValue(date);
}

function parseDateInput(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function clampMinutes(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(24 * 60, Math.round(value)));
}

function clampWeight(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1000, Math.round(value * 10) / 10));
}

function formatMinutes(minutes: number): string {
    const safe = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
}

function formatCards(value: number): string {
    return `${Math.max(0, Math.round(value * 10) / 10).toString().replace(".", ",")} cards`;
}

function percent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function formatScore(value: number): string {
    return (Math.round(value * 10) / 10).toString().replace(".", ",");
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function emptyWeekdayCount(): Record<WeekdayKey, number> {
    return {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
    };
}

function clampPenalty(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(0, Math.min(2, Math.round(value * 10) / 10));
}

function getScoringModel(value: unknown): ScoringModel {
    if (
        value === "discipline_weight" ||
        value === "question_value" ||
        value === "weighted_average" ||
        value === "negative_marking"
    ) {
        return value;
    }
    return "discipline_weight";
}

function computeScorePotential(
    model: ScoringModel,
    weight: number,
    remainingCards: number,
    workloadShare: number,
    completionGap: number,
    wrongPenalty: number
): number {
    const safeWeight = Math.max(0, weight);
    const safeRemaining = Math.max(0, remainingCards);

    if (model === "weighted_average") {
        return safeWeight * (0.7 + workloadShare * 0.3);
    }

    if (model === "negative_marking") {
        return safeRemaining * safeWeight * (1 + completionGap * wrongPenalty);
    }

    return safeRemaining * safeWeight;
}

function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9:;,+\-./\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parseNumericToken(value: string): number {
    return Number(value.replace(",", "."));
}

function firstNumberByPatterns(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            const parsed = parseNumericToken(match[1]);
            if (Number.isFinite(parsed)) {
                return Math.abs(parsed);
            }
        }
    }
    return null;
}

function detectScoringModelFromEdital(text: string): ScoringModel {
    const normalized = normalizeText(text);

    if (
        normalized.includes("errada anula") ||
        normalized.includes("pontuacao negativa") ||
        normalized.includes("penalidade por erro") ||
        /\+\s*1\s*\/\s*-\s*1/.test(normalized)
    ) {
        return "negative_marking";
    }

    if (
        normalized.includes("media ponderada") ||
        (normalized.includes("nota final") && normalized.includes("soma") && normalized.includes("peso"))
    ) {
        return "weighted_average";
    }

    if (
        normalized.includes("cada questao vale") ||
        normalized.includes("valor por questao") ||
        (normalized.includes("questao") && normalized.includes("vale"))
    ) {
        return "question_value";
    }

    return "discipline_weight";
}

function detectPenaltyFromEdital(text: string): number | null {
    const normalized = normalizeText(text);

    if (normalized.includes("anula uma certa") || normalized.includes("errada anula uma certa")) {
        return 1;
    }

    return firstNumberByPatterns(normalized, [
        /penalidade(?: por erro)?\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/,
        /errada(?:s)?\s*vale(?:m)?\s*(-?\d+(?:[.,]\d+)?)/,
        /erro(?:s)?\s*vale(?:m)?\s*(-?\d+(?:[.,]\d+)?)/,
        /\+\s*1\s*\/\s*-\s*(\d+(?:[.,]\d+)?)/,
    ]);
}

function extractDisciplineValue(line: string, model: ScoringModel): number | null {
    const normalized = normalizeText(line);
    const pesoPatterns = [
        /peso(?: da disciplina| da materia|)?\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/,
        /p(?:eso)?\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/,
    ];
    const valorPatterns = [
        /cada questao vale\s*(-?\d+(?:[.,]\d+)?)/,
        /valor(?: por questao| da questao|)\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/,
        /vale\s*(-?\d+(?:[.,]\d+)?)\s*pontos?/,
    ];

    if (model === "weighted_average" || model === "discipline_weight") {
        const parsed = firstNumberByPatterns(normalized, pesoPatterns);
        if (parsed !== null) return parsed;
    }

    if (model === "question_value" || model === "negative_marking") {
        const parsed = firstNumberByPatterns(normalized, [...valorPatterns, ...pesoPatterns]);
        if (parsed !== null) return parsed;
    }

    return firstNumberByPatterns(normalized, [...pesoPatterns, ...valorPatterns]);
}

function buildDisciplineAliases(discipline: DisciplinePlanInput): string[] {
    const aliases = new Set<string>();
    const baseLabel = normalizeText(discipline.label);
    const baseKey = normalizeText(discipline.key.replace(/\d+/g, " "));

    aliases.add(baseLabel);
    aliases.add(baseKey);
    aliases.add(normalizeText(discipline.key));

    if (discipline.key === "portugues") {
        aliases.add("portugues");
        aliases.add("lingua portuguesa");
    }
    if (discipline.key === "rlm") {
        aliases.add("rlm");
        aliases.add("raciocinio logico");
        aliases.add("raciocinio logico matematico");
    }
    if (discipline.key.startsWith("especifica")) {
        aliases.add("especifica");
        aliases.add("especificas");
        aliases.add("especifica de enfermagem");
        aliases.add("enfermagem");
    }
    if (discipline.key.startsWith("sus")) {
        aliases.add("sus");
        aliases.add("saude publica");
    }
    if (discipline.key === "revisao") {
        aliases.add("revisao");
    }
    if (discipline.key === "simulado") {
        aliases.add("simulado");
    }

    return Array.from(aliases).filter((alias) => alias.length > 1);
}

function extractWeightsFromEdital(
    text: string,
    disciplines: DisciplinePlanInput[],
    model: ScoringModel
): Record<string, number> {
    const lines = text
        .replace(/\r/g, "")
        .split(/\n|;/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const normalizedLines = lines.map((line) => normalizeText(line));
    const extracted: Record<string, number> = {};

    disciplines.forEach((discipline) => {
        const aliases = buildDisciplineAliases(discipline);

        for (let i = 0; i < normalizedLines.length; i += 1) {
            const line = normalizedLines[i];
            const hasAlias = aliases.some((alias) => line.includes(alias));
            if (!hasAlias) continue;

            const parsed = extractDisciplineValue(lines[i], model);
            if (parsed !== null) {
                extracted[discipline.key] = clampWeight(parsed);
                break;
            }
        }
    });

    return extracted;
}

function buildDefaultWeightMap(disciplines: PlannerWeightsSeed[]): Record<string, number> {
    return Object.fromEntries(
        disciplines.map((discipline) => [discipline.key, Math.max(1, discipline.remainingCards)])
    );
}

function sanitizeAvailability(input?: Partial<Record<WeekdayKey, number>>): Record<WeekdayKey, number> {
    return Object.fromEntries(
        WEEKDAY_ORDER.map((weekday) => [
            weekday.key,
            clampMinutes(Number(input?.[weekday.key] ?? DEFAULT_AVAILABILITY[weekday.key])),
        ])
    ) as Record<WeekdayKey, number>;
}

function sanitizeWeights(
    disciplines: PlannerWeightsSeed[],
    input?: Record<string, number>
): Record<string, number> {
    return Object.fromEntries(
        disciplines.map((discipline) => [
            discipline.key,
            clampWeight(Number(input?.[discipline.key] ?? Math.max(1, discipline.remainingCards))),
        ])
    );
}

function buildInitialSettings(
    disciplines: PlannerWeightsSeed[],
    storageKey: string
): PlannerSettings {
    const fallback: PlannerSettings = {
        examDate: buildDefaultExamDate(),
        profile: "padrao",
        scoringModel: "discipline_weight",
        wrongPenalty: 1,
        availabilityMinutes: sanitizeAvailability(),
        weightByDiscipline: buildDefaultWeightMap(disciplines),
    };

    if (typeof window === "undefined") {
        return fallback;
    }

    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return fallback;

        const parsed = JSON.parse(raw) as Partial<PlannerSettings>;
        const profile: PlannerProfile =
            parsed.profile === "leve" || parsed.profile === "hardcore"
                ? parsed.profile
                : "padrao";
        const scoringModel = getScoringModel(parsed.scoringModel);
        const wrongPenalty = clampPenalty(Number(parsed.wrongPenalty ?? 1));

        return {
            examDate: typeof parsed.examDate === "string" ? parsed.examDate : fallback.examDate,
            profile,
            scoringModel,
            wrongPenalty,
            availabilityMinutes: sanitizeAvailability(parsed.availabilityMinutes),
            weightByDiscipline: sanitizeWeights(disciplines, parsed.weightByDiscipline),
        };
    } catch {
        return fallback;
    }
}

export default function SmartStudyPlanner({
    disciplines,
    storageKey,
}: SmartStudyPlannerProps) {
    const [settings, setSettings] = useState<PlannerSettings>(() =>
        buildInitialSettings(
            disciplines.map((discipline) => ({
                key: discipline.key,
                remainingCards: discipline.remainingCards,
            })),
            storageKey
        )
    );
    const [editalDraft, setEditalDraft] = useState("");
    const [assistantResult, setAssistantResult] = useState("");

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(settings));
    }, [settings, storageKey]);

    const metrics = useMemo(() => {
        const today = startOfToday();
        const examDate = parseDateInput(settings.examDate);
        const weekdayCount = emptyWeekdayCount();
        const nowKey = JS_DAY_TO_KEY[new Date().getDay()];
        const todayAvailableMinutes = clampMinutes(settings.availabilityMinutes[nowKey]);
        const totalRemainingCards = disciplines.reduce(
            (sum, discipline) => sum + discipline.remainingCards,
            0
        );
        const totalCompletedCards = disciplines.reduce(
            (sum, discipline) => sum + discipline.completedCards,
            0
        );
        const totalCards = disciplines.reduce((sum, discipline) => sum + discipline.totalCards, 0);

        if (!examDate || examDate < today) {
            return {
                valid: false,
                daysUntilExam: 0,
                weeksUntilExam: 0,
                urgencyLevel: 0,
                weekdayCount,
                totalAvailableMinutes: 0,
                todayAvailableMinutes: 0,
                studyDaysCount: 0,
                averageWeeklyMinutes: 0,
                averageStudyDayMinutes: 0,
                totalRemainingCards,
                totalCompletedCards,
                totalCards,
            };
        }

        const cursor = new Date(today);
        while (cursor <= examDate) {
            const key = JS_DAY_TO_KEY[cursor.getDay()];
            weekdayCount[key] += 1;
            cursor.setDate(cursor.getDate() + 1);
        }

        const diffMs = examDate.getTime() - today.getTime();
        const daysUntilExam = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
        const weeksUntilExam = Math.max(1, Math.ceil(daysUntilExam / 7));
        const urgencyLevel = clamp01(1 - daysUntilExam / 180);

        const totalAvailableMinutes = WEEKDAY_ORDER.reduce(
            (sum, weekday) =>
                sum +
                clampMinutes(settings.availabilityMinutes[weekday.key]) *
                    weekdayCount[weekday.key],
            0
        );

        const studyDaysCount = WEEKDAY_ORDER.reduce((sum, weekday) => {
            const minute = clampMinutes(settings.availabilityMinutes[weekday.key]);
            return sum + (minute > 0 ? weekdayCount[weekday.key] : 0);
        }, 0);

        const averageWeeklyMinutes =
            weeksUntilExam > 0 ? totalAvailableMinutes / weeksUntilExam : 0;
        const averageStudyDayMinutes =
            studyDaysCount > 0 ? totalAvailableMinutes / studyDaysCount : 0;

        return {
            valid: true,
            daysUntilExam,
            weeksUntilExam,
            urgencyLevel,
            weekdayCount,
            totalAvailableMinutes,
            todayAvailableMinutes,
            studyDaysCount,
            averageWeeklyMinutes,
            averageStudyDayMinutes,
            totalRemainingCards,
            totalCompletedCards,
            totalCards,
        };
    }, [disciplines, settings.examDate, settings.availabilityMinutes]);

    const disciplinePlan = useMemo(() => {
        const profile = PROFILE_CONFIG[settings.profile];
        const scoringModel = settings.scoringModel;
        const wrongPenalty = settings.wrongPenalty;
        const totalRemainingCards = disciplines.reduce(
            (sum, discipline) => sum + discipline.remainingCards,
            0
        );
        const totalWeight = disciplines.reduce(
            (sum, discipline) =>
                sum +
                Math.max(
                    0,
                    Number(
                        settings.weightByDiscipline[discipline.key] ??
                            Math.max(1, discipline.remainingCards)
                    )
                ),
            0
        );

        const rows = disciplines.map((discipline) => {
            const weight = Math.max(
                0,
                Number(
                    settings.weightByDiscipline[discipline.key] ??
                        Math.max(1, discipline.remainingCards)
                )
            );
            const workloadShare =
                totalRemainingCards > 0
                    ? discipline.remainingCards / totalRemainingCards
                    : 0;
            const weightShare = totalWeight > 0 ? weight / totalWeight : 0;
            const completionRatio =
                discipline.totalCards > 0
                    ? discipline.completedCards / discipline.totalCards
                    : 0;
            const completionGap = clamp01(1 - completionRatio);
            const urgencyBoost =
                1 + metrics.urgencyLevel * 0.45 * profile.urgencyFactor;
            const scorePotential = computeScorePotential(
                scoringModel,
                weight,
                discipline.remainingCards,
                workloadShare,
                completionGap,
                wrongPenalty
            );
            const adjustedWeight =
                Math.pow(scorePotential + 1, profile.weightExponent) - 1;
            const backlogBoost = 1 + workloadShare * profile.backlogFactor;
            const penaltyBoost =
                scoringModel === "negative_marking"
                    ? 1 + wrongPenalty * completionGap * 0.22
                    : 1;
            const riskScore = clamp01(
                (completionGap * 0.58 + workloadShare * 0.42) *
                    urgencyBoost *
                    penaltyBoost
            );
            const criticality = weightShare * 0.62 + workloadShare * 0.38;
            const priorityScore =
                discipline.remainingCards > 0
                    ? adjustedWeight *
                      backlogBoost *
                      (1 + riskScore * profile.riskMultiplier) *
                      (1 + criticality * 0.2)
                    : 0;
            const riskBand =
                riskScore >= 0.68
                    ? "alto"
                    : riskScore >= 0.4
                      ? "medio"
                      : "baixo";
            const recommendation =
                riskBand === "alto"
                    ? "Aumentar foco nesta semana"
                    : riskBand === "medio"
                      ? "Manter ritmo com revisao"
                      : "Ritmo estavel";

            return {
                ...discipline,
                weight,
                workloadShare,
                weightShare,
                completionGap,
                riskScore,
                riskBand,
                recommendation,
                scorePotential,
                priorityScore,
            };
        });

        const totalPriority = rows.reduce((sum, row) => sum + row.priorityScore, 0);
        const maxPriority = rows.reduce(
            (max, row) => Math.max(max, row.priorityScore),
            0
        );

        return rows
            .map((row) => {
                const share = totalPriority > 0 ? row.priorityScore / totalPriority : 0;
                const totalMinutesForDiscipline = metrics.totalAvailableMinutes * share;
                const weeklyMinutes =
                    metrics.weeksUntilExam > 0
                        ? totalMinutesForDiscipline / metrics.weeksUntilExam
                        : 0;
                const minutesPerCard =
                    row.remainingCards > 0
                        ? totalMinutesForDiscipline / row.remainingCards
                        : 0;
                const minutesToday = metrics.todayAvailableMinutes * share;
                const cardsPerWeek =
                    metrics.weeksUntilExam > 0
                        ? row.remainingCards / metrics.weeksUntilExam
                        : 0;
                const cardsPerStudyDay =
                    metrics.studyDaysCount > 0
                        ? row.remainingCards / metrics.studyDaysCount
                        : 0;
                const completedPct =
                    row.totalCards > 0 ? row.completedCards / row.totalCards : 0;
                const priorityPct =
                    maxPriority > 0 ? row.priorityScore / maxPriority : 0;

                return {
                    ...row,
                    share,
                    priorityPct,
                    totalMinutesForDiscipline,
                    weeklyMinutes,
                    minutesPerCard,
                    minutesToday,
                    cardsPerWeek,
                    cardsPerStudyDay,
                    completedPct,
                };
            })
            .sort((a, b) => b.totalMinutesForDiscipline - a.totalMinutesForDiscipline);
    }, [
        disciplines,
        metrics,
        settings.profile,
        settings.scoringModel,
        settings.weightByDiscipline,
        settings.wrongPenalty,
    ]);

    const totalWeight = useMemo(
        () =>
            disciplines.reduce(
                (sum, discipline) =>
                    sum +
                    Math.max(
                        0,
                        Number(
                            settings.weightByDiscipline[discipline.key] ??
                                Math.max(1, discipline.remainingCards)
                        )
                    ),
                0
            ),
        [disciplines, settings.weightByDiscipline]
    );

    const activeProfile = PROFILE_CONFIG[settings.profile];
    const activeScoringModel = SCORING_MODEL_CONFIG[settings.scoringModel];

    function updateAvailability(weekday: WeekdayKey, value: string) {
        const next = clampMinutes(Number(value || 0));
        setSettings((prev) => ({
            ...prev,
            availabilityMinutes: {
                ...prev.availabilityMinutes,
                [weekday]: next,
            },
        }));
    }

    function updateWeight(disciplineKey: string, value: string) {
        const next = clampWeight(Number(value || 0));
        setSettings((prev) => ({
            ...prev,
            weightByDiscipline: {
                ...prev.weightByDiscipline,
                [disciplineKey]: next,
            },
        }));
    }

    function applyEditalAssistant() {
        const raw = editalDraft.trim();
        if (!raw) {
            setAssistantResult("Cole um trecho do edital para aplicar automaticamente.");
            return;
        }

        const detectedModel = detectScoringModelFromEdital(raw);
        const detectedPenalty = detectPenaltyFromEdital(raw);
        const extractedWeights = extractWeightsFromEdital(raw, disciplines, detectedModel);
        const updatedCount = Object.keys(extractedWeights).length;

        setSettings((prev) => {
            const nextWeights = { ...prev.weightByDiscipline };
            disciplines.forEach((discipline) => {
                const found = extractedWeights[discipline.key];
                if (typeof found === "number" && Number.isFinite(found)) {
                    nextWeights[discipline.key] = clampWeight(found);
                }
            });

            return {
                ...prev,
                scoringModel: detectedModel,
                wrongPenalty:
                    detectedModel === "negative_marking"
                        ? clampPenalty(detectedPenalty ?? prev.wrongPenalty)
                        : prev.wrongPenalty,
                weightByDiscipline: nextWeights,
            };
        });

        const modelLabel = SCORING_MODEL_CONFIG[detectedModel].label;
        const penaltyLabel =
            detectedModel === "negative_marking"
                ? ` | Penalidade: ${formatScore(clampPenalty(detectedPenalty ?? settings.wrongPenalty))}`
                : "";
        setAssistantResult(
            `Assistente aplicado. Modelo detectado: ${modelLabel}. Disciplinas atualizadas: ${updatedCount}/${disciplines.length}${penaltyLabel}.`
        );
    }

    return (
        <section className={styles.panel}>
            <header className={styles.header}>
                <div>
                    <p className={styles.kicker}>Planejador Inteligente</p>
                    <h2>Tempo Ideal por Materia e por Card</h2>
                    <p className={styles.subtitle}>
                        Informe sua prova, sua disponibilidade e os pesos das disciplinas.
                        O cronograma calcula automaticamente sua distribuicao de tempo.
                    </p>
                </div>
            </header>

            <div className={styles.formGrid}>
                <div className={styles.configCard}>
                    <label className={styles.field}>
                        <span>Data do Concurso</span>
                        <input
                            type="date"
                            value={settings.examDate}
                            onChange={(event) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    examDate: event.target.value,
                                }))
                            }
                        />
                    </label>
                    <div className={styles.fieldHint}>
                        O calculo considera o periodo de hoje ate a data informada (inclusive).
                    </div>
                    <div className={styles.profileWrap}>
                        <span className={styles.profileLabel}>Perfil de Ritmo</span>
                        <div className={styles.profileSwitch}>
                            {(Object.keys(PROFILE_CONFIG) as PlannerProfile[]).map((profileKey) => (
                                <button
                                    key={profileKey}
                                    type="button"
                                    className={`${styles.profileButton} ${
                                        settings.profile === profileKey ? styles.profileButtonActive : ""
                                    }`}
                                    onClick={() =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            profile: profileKey,
                                        }))
                                    }
                                >
                                    {PROFILE_CONFIG[profileKey].label}
                                </button>
                            ))}
                        </div>
                        <small className={styles.profileDescription}>
                            {activeProfile.description}
                        </small>
                    </div>
                    <div className={styles.modelWrap}>
                        <span className={styles.modelLabel}>Modelo de Pontuacao do Edital</span>
                        <div className={styles.modelSwitch}>
                            {(Object.keys(SCORING_MODEL_CONFIG) as ScoringModel[]).map(
                                (modelKey) => (
                                    <button
                                        key={modelKey}
                                        type="button"
                                        className={`${styles.modelButton} ${
                                            settings.scoringModel === modelKey
                                                ? styles.modelButtonActive
                                                : ""
                                        }`}
                                        onClick={() =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                scoringModel: modelKey,
                                            }))
                                        }
                                    >
                                        {SCORING_MODEL_CONFIG[modelKey].label}
                                    </button>
                                )
                            )}
                        </div>
                        {settings.scoringModel === "negative_marking" && (
                            <label className={styles.inlineField}>
                                <span>Penalidade por Erro</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={2}
                                    step={0.1}
                                    value={settings.wrongPenalty}
                                    onChange={(event) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            wrongPenalty: clampPenalty(
                                                Number(event.target.value)
                                            ),
                                        }))
                                    }
                                />
                            </label>
                        )}
                        <small className={styles.modelFormula}>
                            {activeScoringModel.formulaText}
                        </small>
                    </div>
                    <div className={styles.assistantWrap}>
                        <span className={styles.modelLabel}>Assistente de Edital</span>
                        <textarea
                            className={styles.assistantTextarea}
                            value={editalDraft}
                            onChange={(event) => setEditalDraft(event.target.value)}
                            placeholder="Cole aqui o trecho do edital com pesos/valores por disciplina. Ex: Portugues peso 2; Especificas peso 3; errada anula uma certa."
                        />
                        <div className={styles.assistantActions}>
                            <button
                                type="button"
                                className={styles.assistantButton}
                                onClick={applyEditalAssistant}
                            >
                                Aplicar Assistente
                            </button>
                            <button
                                type="button"
                                className={styles.assistantGhostButton}
                                onClick={() => {
                                    setEditalDraft("");
                                    setAssistantResult("");
                                }}
                            >
                                Limpar
                            </button>
                        </div>
                        {assistantResult && (
                            <p className={styles.assistantResult}>{assistantResult}</p>
                        )}
                    </div>
                </div>

                <div className={styles.configCard}>
                    <h3>Disponibilidade por Dia (min)</h3>
                    <div className={styles.availabilityGrid}>
                        {WEEKDAY_ORDER.map((weekday) => (
                            <label key={weekday.key} className={styles.field}>
                                <span>{weekday.label}</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={1440}
                                    value={settings.availabilityMinutes[weekday.key]}
                                    onChange={(event) =>
                                        updateAvailability(weekday.key, event.target.value)
                                    }
                                />
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {!metrics.valid ? (
                <p className={styles.notice}>
                    Informe uma data de concurso futura para calcular seu plano.
                </p>
            ) : (
                <>
                    <div className={styles.summaryGrid}>
                        <article>
                            <span>Dias Ate a Prova</span>
                            <strong>{metrics.daysUntilExam}</strong>
                        </article>
                        <article>
                            <span>Tempo Total Disponivel</span>
                            <strong>{formatMinutes(metrics.totalAvailableMinutes)}</strong>
                        </article>
                        <article>
                            <span>Meta Semanal Media</span>
                            <strong>{formatMinutes(metrics.averageWeeklyMinutes)}</strong>
                        </article>
                        <article>
                            <span>Cards Restantes</span>
                            <strong>{metrics.totalRemainingCards}</strong>
                        </article>
                        <article>
                            <span>Pressao de Prazo</span>
                            <strong>{percent(metrics.urgencyLevel)}</strong>
                        </article>
                        <article>
                            <span>Tempo Hoje</span>
                            <strong>{formatMinutes(metrics.todayAvailableMinutes)}</strong>
                        </article>
                        <article>
                            <span>Media por Dia de Estudo</span>
                            <strong>{formatMinutes(metrics.averageStudyDayMinutes)}</strong>
                        </article>
                        <article>
                            <span>Cards Ja Concluidos</span>
                            <strong>{metrics.totalCompletedCards}</strong>
                        </article>
                        <article>
                            <span>Total de Cards</span>
                            <strong>{metrics.totalCards}</strong>
                        </article>
                        <article>
                            <span>Modelo</span>
                            <strong>{activeScoringModel.label}</strong>
                        </article>
                    </div>

                    <section className={styles.weightsSection}>
                        <header className={styles.sectionHeader}>
                            <h3>{activeScoringModel.weightInputLabel}</h3>
                            <small>
                                Perfil: {activeProfile.label} | Total: {totalWeight}
                            </small>
                        </header>
                        <div className={styles.weightsGrid}>
                            {disciplinePlan.map((row) => (
                                <label key={row.key} className={styles.weightCard}>
                                    <span>{row.label}</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={1000}
                                        step={0.1}
                                        value={row.weight}
                                        onChange={(event) =>
                                            updateWeight(row.key, event.target.value)
                                        }
                                    />
                                    <small>
                                        {row.remainingCards} cards restantes | potencial{" "}
                                        {formatScore(row.scorePotential)}
                                    </small>
                                </label>
                            ))}
                        </div>
                        {totalWeight <= 0 && (
                            <p className={styles.warning}>
                                Defina pesos acima de zero para gerar a distribuicao de tempo.
                            </p>
                        )}
                    </section>

                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Materia</th>
                                    <th>Concluido</th>
                                    <th>Cards</th>
                                    <th>{activeScoringModel.tableWeightLabel}</th>
                                    <th>Potencial</th>
                                    <th>Participacao</th>
                                    <th>Prioridade</th>
                                    <th>Risco</th>
                                    <th>Tempo por Card</th>
                                    <th>Meta Semanal</th>
                                    <th>Cards/Semana</th>
                                    <th>Cards/Dia</th>
                                    <th>Sugestao para Hoje</th>
                                </tr>
                            </thead>
                            <tbody>
                                {disciplinePlan.map((row) => (
                                    <tr key={row.key}>
                                        <td>{row.label}</td>
                                        <td>{percent(row.completedPct)}</td>
                                        <td>{row.remainingCards}</td>
                                        <td className={styles.weightCell}>
                                            <input
                                                type="number"
                                                min={0}
                                                max={1000}
                                                step={0.1}
                                                value={row.weight}
                                                onChange={(event) =>
                                                    updateWeight(row.key, event.target.value)
                                                }
                                            />
                                        </td>
                                        <td>{formatScore(row.scorePotential)}</td>
                                        <td>
                                            <div className={styles.shareCell}>
                                                <span>{percent(row.share)}</span>
                                                <div className={styles.shareTrack}>
                                                    <i
                                                        style={{
                                                            width: `${Math.max(0, Math.min(100, row.share * 100))}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.shareCell}>
                                                <span>{percent(row.priorityPct)}</span>
                                                <div className={styles.shareTrack}>
                                                    <i
                                                        style={{
                                                            width: `${Math.max(0, Math.min(100, row.priorityPct * 100))}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className={`${styles.riskBadge} ${
                                                    row.riskBand === "alto"
                                                        ? styles.riskHigh
                                                        : row.riskBand === "medio"
                                                          ? styles.riskMedium
                                                          : styles.riskLow
                                                }`}
                                                title={row.recommendation}
                                            >
                                                {row.riskBand}
                                            </span>
                                        </td>
                                        <td>{formatMinutes(row.minutesPerCard)}</td>
                                        <td>{formatMinutes(row.weeklyMinutes)}</td>
                                        <td>{formatCards(row.cardsPerWeek)}</td>
                                        <td>{formatCards(row.cardsPerStudyDay)}</td>
                                        <td>{formatMinutes(row.minutesToday)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </section>
    );
}
