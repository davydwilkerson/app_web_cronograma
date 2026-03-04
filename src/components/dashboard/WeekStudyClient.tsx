"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
    WeekCardData,
    WeekDayData,
    WeekProgressState,
} from "@/types/week-study";
import { TOTAL_WEEKS } from "@/types/content";
import styles from "./WeekStudyClient.module.css";

interface WeekStudyClientProps {
    weekNum: number;
    days: WeekDayData[];
    initialProgress: Record<string, WeekProgressState>;
}

const DISCIPLINE_CLASS_MAP: Record<string, string> = {
    portugues: styles.portugues,
    especifica1: styles.especifica1,
    especifica2: styles.especifica2,
    rlm: styles.rlm,
    sus1: styles.sus1,
    sus2: styles.sus2,
    revisao: styles.revisao,
    simulado: styles.simulado,
};

function clampPercent(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

function getLinkIcon(type: string, label: string): string {
    const normalized = `${type} ${label}`.toLowerCase();
    if (normalized.includes("video") || normalized.includes("teoria")) {
        return "fa-play-circle";
    }
    if (normalized.includes("pdf")) {
        return "fa-file-pdf";
    }
    if (normalized.includes("exercise") || normalized.includes("exercicio")) {
        return "fa-tasks";
    }
    if (normalized.includes("exam") || normalized.includes("simulado")) {
        return "fa-file-alt";
    }
    if (normalized.includes("law") || normalized.includes("lei")) {
        return "fa-scale-balanced";
    }
    if (normalized.includes("material")) {
        return "fa-book";
    }
    return "fa-info-circle";
}

function isVideoLink(type: string, label: string): boolean {
    const normalized = `${type} ${label}`.toLowerCase();
    return (
        normalized.includes("video") ||
        normalized.includes("teoria") ||
        type === "video"
    );
}

function parseYouTubeVideoId(rawUrl: string): string | null {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.replace(/^www\./, "").toLowerCase();

        if (host === "youtu.be") {
            const id = url.pathname.split("/").filter(Boolean)[0] || "";
            return id || null;
        }

        if (
            host === "youtube.com" ||
            host === "m.youtube.com" ||
            host === "youtube-nocookie.com"
        ) {
            if (url.pathname === "/watch") {
                const id = url.searchParams.get("v") || "";
                return id || null;
            }

            if (url.pathname.startsWith("/embed/")) {
                const id = url.pathname.split("/embed/")[1]?.split("/")[0] || "";
                return id || null;
            }

            if (url.pathname.startsWith("/shorts/")) {
                const id = url.pathname.split("/shorts/")[1]?.split("/")[0] || "";
                return id || null;
            }
        }
    } catch {
        return null;
    }

    return null;
}

function buildYoutubeEmbedUrl(rawUrl: string): string | null {
    const videoId = parseYouTubeVideoId(rawUrl);
    if (!videoId) return null;
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0&disablekb=1`;
}

function defaultProgress(card: WeekCardData): WeekProgressState {
    const progressData: Record<string, number> = {};
    for (const item of card.progressItems) {
        progressData[item.key] = 0;
    }
    return { isCompleted: false, progressData };
}

function normalizeProgress(card: WeekCardData, state?: WeekProgressState): WeekProgressState {
    const fallback = defaultProgress(card);
    if (!state) {
        return fallback;
    }

    const progressData: Record<string, number> = { ...fallback.progressData };
    for (const [key, value] of Object.entries(state.progressData || {})) {
        progressData[key] = clampPercent(value);
    }

    const keys = Object.keys(progressData);
    const autoComplete = keys.length > 0 && keys.every((key) => progressData[key] >= 100);

    return {
        isCompleted: state.isCompleted || autoComplete,
        progressData,
    };
}

function buildCardMap(days: WeekDayData[]): Map<string, WeekCardData> {
    const map = new Map<string, WeekCardData>();
    for (const day of days) {
        for (const card of day.cards) {
            map.set(card.cardId, card);
        }
    }
    return map;
}

export default function WeekStudyClient({
    weekNum,
    days,
    initialProgress,
}: WeekStudyClientProps) {
    const cardsById = useMemo(() => buildCardMap(days), [days]);
    const allCards = useMemo(() => days.flatMap((day) => day.cards), [days]);
    const [activeDay, setActiveDay] = useState<number>(days[0]?.dayNum ?? 1);
    const [savingCardId, setSavingCardId] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [activeVideoByCard, setActiveVideoByCard] = useState<
        Record<string, string>
    >({});
    const [progressByCard, setProgressByCard] = useState<Record<string, WeekProgressState>>(() => {
        const seeded: Record<string, WeekProgressState> = {};
        for (const card of allCards) {
            seeded[card.cardId] = normalizeProgress(card, initialProgress[card.cardId]);
        }
        return seeded;
    });

    const completedCards = allCards.reduce((count, card) => {
        const state = normalizeProgress(card, progressByCard[card.cardId]);
        return count + (state.isCompleted ? 1 : 0);
    }, 0);

    const totalCards = allCards.length;
    const weekPercentage =
        totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;
    const currentDay = days.find((day) => day.dayNum === activeDay) || days[0];

    async function persistCard(cardId: string, nextState: WeekProgressState) {
        setSavingCardId(cardId);
        setErrorMessage("");

        try {
            const response = await fetch("/api/progress", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    weekNum,
                    cardId,
                    isCompleted: nextState.isCompleted,
                    progressData: nextState.progressData,
                }),
            });

            if (!response.ok) {
                throw new Error("Falha ao salvar progresso");
            }

            const payload = (await response.json()) as {
                progress?: {
                    cardId: string;
                    isCompleted: boolean;
                    progressData?: Record<string, number>;
                };
            };

            const card = cardsById.get(cardId);
            if (!card || !payload.progress) return;

            const normalized = normalizeProgress(card, {
                isCompleted: payload.progress.isCompleted,
                progressData: payload.progress.progressData || {},
            });

            setProgressByCard((prev) => ({
                ...prev,
                [cardId]: normalized,
            }));
        } catch (error) {
            console.error(error);
            setErrorMessage("Nao foi possivel salvar o progresso. Tente novamente.");
        } finally {
            setSavingCardId("");
        }
    }

    function handleToggleCard(card: WeekCardData) {
        const current = normalizeProgress(card, progressByCard[card.cardId]);
        const markCompleted = !current.isCompleted;
        const nextProgressData: Record<string, number> = {};

        for (const item of card.progressItems) {
            nextProgressData[item.key] = markCompleted ? 100 : 0;
        }

        const nextState: WeekProgressState = {
            isCompleted: markCompleted,
            progressData: nextProgressData,
        };

        setProgressByCard((prev) => ({
            ...prev,
            [card.cardId]: nextState,
        }));
        void persistCard(card.cardId, nextState);
    }

    function handleProgressStep(card: WeekCardData, key: string) {
        const current = normalizeProgress(card, progressByCard[card.cardId]);
        const currentValue = current.progressData[key] || 0;
        const nextValue = currentValue >= 100 ? 0 : currentValue + 25;
        const nextProgressData = {
            ...current.progressData,
            [key]: clampPercent(nextValue),
        };

        const progressKeys = card.progressItems.map((item) => item.key);
        const isCompleted =
            progressKeys.length > 0 &&
            progressKeys.every((progressKey) => (nextProgressData[progressKey] || 0) >= 100);

        const nextState: WeekProgressState = {
            isCompleted,
            progressData: nextProgressData,
        };

        setProgressByCard((prev) => ({
            ...prev,
            [card.cardId]: nextState,
        }));
        void persistCard(card.cardId, nextState);
    }

    function handleVideoToggle(cardId: string, embedUrl: string) {
        setActiveVideoByCard((prev) => {
            const isSame = prev[cardId] === embedUrl;
            return {
                ...prev,
                [cardId]: isSame ? "" : embedUrl,
            };
        });
    }

    return (
        <div className={styles.wrapper}>
            <section className={styles.progressSection}>
                <div className={styles.progressHeader}>
                    <h2>Semana {weekNum}</h2>
                    <span>
                        {completedCards}/{totalCards} cards concluidos
                    </span>
                </div>
                <div className={styles.progressTrack}>
                    <div
                        className={styles.progressFill}
                        style={{ width: `${weekPercentage}%` }}
                    />
                </div>
                <div className={styles.progressFooter}>
                    <span>Progresso da semana</span>
                    <strong>{weekPercentage}%</strong>
                </div>
            </section>

            {errorMessage && <p className={styles.errorBanner}>{errorMessage}</p>}

            <nav className={styles.daysNav}>
                {days.map((day) => (
                    <button
                        key={day.dayNum}
                        type="button"
                        onClick={() => setActiveDay(day.dayNum)}
                        className={`${styles.dayBtn} ${activeDay === day.dayNum ? styles.dayBtnActive : ""}`}
                    >
                        D{day.dayNum}
                    </button>
                ))}
            </nav>

            {currentDay && (
                <section className={styles.cardsSection}>
                    <div className={styles.dayHeader}>
                        <h3>Dia {currentDay.dayNum}</h3>
                        <span>{currentDay.cards.length} atividades</span>
                    </div>

                    <div className={styles.cardsList}>
                        {currentDay.cards.map((card) => {
                            const state = normalizeProgress(card, progressByCard[card.cardId]);
                            const disciplineClass = DISCIPLINE_CLASS_MAP[card.discipline] || "";

                            return (
                                <article
                                    key={card.cardId}
                                    className={`${styles.studyCard} ${disciplineClass}`}
                                >
                                    <div className={styles.cardHeader}>
                                        <button
                                            type="button"
                                            className={`${styles.cardCheckbox} ${state.isCompleted ? styles.cardChecked : ""}`}
                                            onClick={() => handleToggleCard(card)}
                                            disabled={savingCardId === card.cardId}
                                            title="Marcar card"
                                        >
                                            <i className="fas fa-check"></i>
                                        </button>

                                        <div className={styles.cardInfo}>
                                            <span className={styles.disciplineBadge}>
                                                {card.discipline}
                                            </span>
                                            <h4 className={styles.cardTitle}>{card.title}</h4>
                                        </div>
                                    </div>

                                    {card.links.length > 0 && (
                                        <div className={styles.cardLinks}>
                                            {card.links.map((link, index) => {
                                                const isVideo = isVideoLink(
                                                    link.type,
                                                    link.label
                                                );
                                                const embedUrl = link.url
                                                    ? buildYoutubeEmbedUrl(link.url)
                                                    : null;
                                                const isSelected =
                                                    embedUrl &&
                                                    activeVideoByCard[card.cardId] === embedUrl;

                                                if (isVideo && embedUrl) {
                                                    return (
                                                        <button
                                                            key={`${card.cardId}-link-${index}`}
                                                            type="button"
                                                            className={`${styles.cardLink} ${styles.videoTrigger} ${isSelected ? styles.videoTriggerActive : ""}`}
                                                            onClick={() =>
                                                                handleVideoToggle(
                                                                    card.cardId,
                                                                    embedUrl
                                                                )
                                                            }
                                                        >
                                                            <i
                                                                className={`fas ${getLinkIcon(link.type, link.label)}`}
                                                            ></i>
                                                            <span>{link.label}</span>
                                                        </button>
                                                    );
                                                }

                                                return link.url ? (
                                                    <a
                                                        key={`${card.cardId}-link-${index}`}
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`${styles.cardLink} ${link.isPrimary ? styles.cardLinkPrimary : ""}`}
                                                    >
                                                        <i
                                                            className={`fas ${getLinkIcon(link.type, link.label)}`}
                                                        ></i>
                                                        <span>{link.label}</span>
                                                    </a>
                                                ) : (
                                                    <span
                                                        key={`${card.cardId}-link-${index}`}
                                                        className={styles.cardLink}
                                                    >
                                                        <i
                                                            className={`fas ${getLinkIcon(link.type, link.label)}`}
                                                        ></i>
                                                        <span>{link.label}</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {activeVideoByCard[card.cardId] && (
                                        <div className={styles.videoEmbedWrap}>
                                            <div className={styles.videoEmbedHead}>
                                                <strong>Aula em video</strong>
                                                <button
                                                    type="button"
                                                    className={styles.videoCloseBtn}
                                                    onClick={() =>
                                                        setActiveVideoByCard((prev) => ({
                                                            ...prev,
                                                            [card.cardId]: "",
                                                        }))
                                                    }
                                                >
                                                    Fechar
                                                </button>
                                            </div>

                                            <div
                                                className={styles.videoFrame}
                                                onContextMenu={(event) =>
                                                    event.preventDefault()
                                                }
                                            >
                                                <iframe
                                                    src={activeVideoByCard[card.cardId]}
                                                    title={`${card.title} - video`}
                                                    loading="lazy"
                                                    allow="autoplay; encrypted-media; picture-in-picture"
                                                    allowFullScreen={false}
                                                    referrerPolicy="strict-origin-when-cross-origin"
                                                    sandbox="allow-scripts allow-same-origin allow-presentation"
                                                />
                                                <span className={styles.videoWatermark}>
                                                    Plataforma EA
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {card.progressItems.length > 0 && (
                                        <div className={styles.progressList}>
                                            {card.progressItems.map((item) => {
                                                const value = clampPercent(
                                                    state.progressData[item.key] || 0
                                                );
                                                return (
                                                    <div
                                                        key={`${card.cardId}-${item.key}`}
                                                        className={styles.progressItem}
                                                    >
                                                        <span className={styles.progressItemLabel}>
                                                            {item.label}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className={styles.progressButton}
                                                            onClick={() =>
                                                                handleProgressStep(card, item.key)
                                                            }
                                                            disabled={savingCardId === card.cardId}
                                                        >
                                                            <span
                                                                className={styles.progressItemFill}
                                                                style={{ width: `${value}%` }}
                                                            />
                                                        </button>
                                                        <strong>{value}%</strong>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            <div className={styles.weekNav}>
                <Link href="/dashboard" className={styles.weekNavButton}>
                    <i className="fas fa-arrow-left"></i> Voltar ao dashboard
                </Link>
                <div className={styles.weekNavLinks}>
                    {weekNum > 1 && (
                        <Link
                            href={`/dashboard/semana/${weekNum - 1}`}
                            className={styles.weekNavButton}
                        >
                            Semana anterior
                        </Link>
                    )}
                    {weekNum < TOTAL_WEEKS && (
                        <Link
                            href={`/dashboard/semana/${weekNum + 1}`}
                            className={`${styles.weekNavButton} ${styles.weekNavPrimary}`}
                        >
                            Proxima semana
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
