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
    availabilityMinutes: Record<WeekdayKey, number>;
    weightByDiscipline: Record<string, number>;
}

interface PlannerWeightsSeed {
    key: string;
    remainingCards: number;
}

type PlannerProfile = "leve" | "padrao" | "hardcore";

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
            Math.max(
                0,
                Math.min(
                    1000,
                    Math.round(Number(input?.[discipline.key] ?? Math.max(1, discipline.remainingCards)))
                )
            ),
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
        return {
            examDate: typeof parsed.examDate === "string" ? parsed.examDate : fallback.examDate,
            profile,
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
            const adjustedWeight =
                Math.pow(weight + 1, profile.weightExponent) - 1;
            const backlogBoost = 1 + workloadShare * profile.backlogFactor;
            const riskScore = clamp01(
                (completionGap * 0.58 + workloadShare * 0.42) * urgencyBoost
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
    }, [disciplines, metrics, settings.profile, settings.weightByDiscipline]);

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
        const next = Math.max(0, Math.min(1000, Math.round(Number(value || 0))));
        setSettings((prev) => ({
            ...prev,
            weightByDiscipline: {
                ...prev.weightByDiscipline,
                [disciplineKey]: next,
            },
        }));
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
                    </div>

                    <section className={styles.weightsSection}>
                        <header className={styles.sectionHeader}>
                            <h3>Pesos na Prova</h3>
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
                                        value={row.weight}
                                        onChange={(event) =>
                                            updateWeight(row.key, event.target.value)
                                        }
                                    />
                                    <small>{row.remainingCards} cards restantes</small>
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
                                    <th>Peso</th>
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
                                                value={row.weight}
                                                onChange={(event) =>
                                                    updateWeight(row.key, event.target.value)
                                                }
                                            />
                                        </td>
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
