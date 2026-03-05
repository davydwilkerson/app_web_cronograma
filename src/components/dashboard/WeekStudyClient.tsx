"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

interface ActiveVideoState {
    cardId: string;
    playerId: string;
    embedUrl: string;
    title: string;
}

interface PlayerTelemetry {
    currentTime: number;
    duration: number;
    playbackRate: number;
    playerState: number;
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
    const origin =
        typeof window !== "undefined"
            ? `&origin=${encodeURIComponent(window.location.origin)}`
            : "";
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0&disablekb=1&enablejsapi=1${origin}`;
}

function sanitizeId(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function buildPlayerId(cardId: string): string {
    return `ytplayer-${sanitizeId(cardId)}`;
}

function postPlayerMessage(playerId: string, payload: unknown) {
    if (typeof document === "undefined") return;
    const iframe = document.getElementById(playerId) as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(JSON.stringify(payload), "*");
}

function sendPlayerCommand(playerId: string, func: string, args: unknown[] = []) {
    postPlayerMessage(playerId, {
        event: "command",
        func,
        args,
        id: playerId,
    });
}

function formatSeconds(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
    const total = Math.max(0, Math.floor(seconds));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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
    const [xpGainMessage, setXpGainMessage] = useState<string>("");
    const [showNurseCelebration, setShowNurseCelebration] = useState(false);
    const [nurseCelebrationTick, setNurseCelebrationTick] = useState(0);
    const [activeVideo, setActiveVideo] = useState<ActiveVideoState | null>(null);
    const [playerStatsById, setPlayerStatsById] = useState<Record<string, PlayerTelemetry>>({});
    const activeVideoRef = useRef<ActiveVideoState | null>(null);
    const nurseTimeoutRef = useRef<number | null>(null);
    const [progressByCard, setProgressByCard] = useState<Record<string, WeekProgressState>>(() => {
        const seeded: Record<string, WeekProgressState> = {};
        for (const card of allCards) {
            seeded[card.cardId] = normalizeProgress(card, initialProgress[card.cardId]);
        }
        return seeded;
    });

    useEffect(() => {
        activeVideoRef.current = activeVideo;
    }, [activeVideo]);

    useEffect(() => {
        if (!xpGainMessage) return;
        const timeout = window.setTimeout(() => setXpGainMessage(""), 2200);
        return () => window.clearTimeout(timeout);
    }, [xpGainMessage]);

    useEffect(() => {
        return () => {
            if (nurseTimeoutRef.current) {
                window.clearTimeout(nurseTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        function handlePlayerMessage(event: MessageEvent) {
            if (typeof event.data !== "string") return;
            if (!event.origin.includes("youtube")) return;

            let payload: unknown;
            try {
                payload = JSON.parse(event.data);
            } catch {
                return;
            }

            if (!payload || typeof payload !== "object") return;

            const data = payload as {
                event?: string;
                id?: string;
                info?: {
                    currentTime?: number;
                    duration?: number;
                    playbackRate?: number;
                    playerState?: number;
                };
            };

            if (data.event !== "infoDelivery" || !data.id || !data.info) return;

            const playerId = data.id;
            const info = data.info;

            setPlayerStatsById((prev) => {
                const existing = prev[playerId] || {
                    currentTime: 0,
                    duration: 0,
                    playbackRate: 1,
                    playerState: -1,
                };

                let changed = false;
                const next = { ...existing };

                if (
                    typeof info.currentTime === "number" &&
                    Math.abs(info.currentTime - existing.currentTime) >= 0.4
                ) {
                    next.currentTime = info.currentTime;
                    changed = true;
                }

                if (
                    typeof info.duration === "number" &&
                    Math.abs(info.duration - existing.duration) > 0.1
                ) {
                    next.duration = info.duration;
                    changed = true;
                }

                if (
                    typeof info.playbackRate === "number" &&
                    Math.abs(info.playbackRate - existing.playbackRate) > 0.01
                ) {
                    next.playbackRate = info.playbackRate;
                    changed = true;
                }

                if (
                    typeof info.playerState === "number" &&
                    info.playerState !== existing.playerState
                ) {
                    next.playerState = info.playerState;
                    changed = true;
                }

                return changed ? { ...prev, [playerId]: next } : prev;
            });
        }

        window.addEventListener("message", handlePlayerMessage);
        return () => window.removeEventListener("message", handlePlayerMessage);
    }, []);

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
                xpDelta?: number;
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

            if (typeof payload.xpDelta === "number" && payload.xpDelta > 0) {
                setXpGainMessage(`+${payload.xpDelta} XP`);
            }
        } catch (error) {
            console.error(error);
            setErrorMessage("Não foi possível salvar o progresso. Tente novamente.");
        } finally {
            setSavingCardId("");
        }
    }

    function triggerNurseCelebration() {
        setNurseCelebrationTick((prev) => prev + 1);
        setShowNurseCelebration(true);
        if (nurseTimeoutRef.current) {
            window.clearTimeout(nurseTimeoutRef.current);
        }
        nurseTimeoutRef.current = window.setTimeout(() => {
            setShowNurseCelebration(false);
        }, 1900);
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
        if (markCompleted) {
            triggerNurseCelebration();
        }
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

    function handleVideoToggle(
        cardId: string,
        cardTitle: string,
        embedUrl: string
    ) {
        const playerId = buildPlayerId(cardId);

        if (
            activeVideoRef.current &&
            activeVideoRef.current.cardId === cardId &&
            activeVideoRef.current.embedUrl === embedUrl
        ) {
            setActiveVideo(null);
            return;
        }

        setActiveVideo({
            cardId,
            playerId,
            embedUrl,
            title: cardTitle,
        });

        setPlayerStatsById((prev) => ({
            ...prev,
            [playerId]: prev[playerId] || {
                currentTime: 0,
                duration: 0,
                playbackRate: 1,
                playerState: -1,
            },
        }));
    }

    function initVideoPlayer(playerId: string) {
        postPlayerMessage(playerId, { event: "listening", id: playerId });
        sendPlayerCommand(playerId, "playVideo");
        sendPlayerCommand(playerId, "getCurrentTime");
        sendPlayerCommand(playerId, "getDuration");
        sendPlayerCommand(playerId, "getPlaybackRate");
        sendPlayerCommand(playerId, "getPlayerState");
    }

    function handlePlayPause() {
        if (!activeVideo) return;
        const stats = playerStatsById[activeVideo.playerId];
        const isPlaying = stats?.playerState === 1;

        if (isPlaying) {
            sendPlayerCommand(activeVideo.playerId, "pauseVideo");
        } else {
            sendPlayerCommand(activeVideo.playerId, "playVideo");
        }
    }

    function handleSeek(deltaSeconds: number) {
        if (!activeVideo) return;
        const stats = playerStatsById[activeVideo.playerId];
        const currentTime = stats?.currentTime || 0;
        const targetTime = Math.max(0, currentTime + deltaSeconds);

        sendPlayerCommand(activeVideo.playerId, "seekTo", [targetTime, true]);

        setPlayerStatsById((prev) => ({
            ...prev,
            [activeVideo.playerId]: {
                ...(prev[activeVideo.playerId] || {
                    currentTime: 0,
                    duration: 0,
                    playbackRate: 1,
                    playerState: -1,
                }),
                currentTime: targetTime,
            },
        }));
    }

    function handleSpeed(rate: number) {
        if (!activeVideo) return;
        sendPlayerCommand(activeVideo.playerId, "setPlaybackRate", [rate]);

        setPlayerStatsById((prev) => ({
            ...prev,
            [activeVideo.playerId]: {
                ...(prev[activeVideo.playerId] || {
                    currentTime: 0,
                    duration: 0,
                    playbackRate: 1,
                    playerState: -1,
                }),
                playbackRate: rate,
            },
        }));
    }

    function handleTimelineChange(percentValue: number) {
        if (!activeVideo) return;
        const stats = playerStatsById[activeVideo.playerId];
        const duration = stats?.duration || 0;
        if (duration <= 0) return;

        const normalizedPercent = Math.max(0, Math.min(100, percentValue));
        const targetTime = (duration * normalizedPercent) / 100;

        sendPlayerCommand(activeVideo.playerId, "seekTo", [targetTime, true]);

        setPlayerStatsById((prev) => ({
            ...prev,
            [activeVideo.playerId]: {
                ...(prev[activeVideo.playerId] || {
                    currentTime: 0,
                    duration,
                    playbackRate: 1,
                    playerState: -1,
                }),
                currentTime: targetTime,
            },
        }));
    }

    const activePlayerStats = activeVideo
        ? playerStatsById[activeVideo.playerId]
        : undefined;
    const isActivePlaying = activePlayerStats?.playerState === 1;
    const activePlaybackRate = activePlayerStats?.playbackRate || 1;
    const activeDuration = activePlayerStats?.duration || 0;
    const activeCurrentTime = activePlayerStats?.currentTime || 0;
    const activeProgressPercent =
        activeDuration > 0 ? (activeCurrentTime / activeDuration) * 100 : 0;
    const showPauseOverlay =
        activePlayerStats?.playerState === 2 || activePlayerStats?.playerState === 0;

    useEffect(() => {
        if (!activeVideo) return;

        const interval = window.setInterval(() => {
            sendPlayerCommand(activeVideo.playerId, "getCurrentTime");
            sendPlayerCommand(activeVideo.playerId, "getDuration");
            sendPlayerCommand(activeVideo.playerId, "getPlayerState");
        }, 800);

        return () => window.clearInterval(interval);
    }, [activeVideo]);

    return (
        <div className={styles.wrapper}>
            {showNurseCelebration && (
                <div className={styles.nurseCelebrationOverlay} aria-hidden="true">
                    <div
                        key={nurseCelebrationTick}
                        className={styles.nurseCelebrationActor}
                    >
                        <div className={styles.nurseCelebrationAvatarShell}>
                            <Image
                                src="/assets/avatar-nurse-trophy.svg"
                                alt=""
                                width={94}
                                height={94}
                                className={styles.nurseCelebrationAvatar}
                            />
                        </div>
                        <span className={styles.nurseCelebrationThumb}>
                            <i className="fas fa-thumbs-up"></i>
                        </span>
                    </div>
                </div>
            )}

            <section className={styles.progressSection}>
                <div className={styles.progressHeader}>
                    <h2>Semana {weekNum}</h2>
                    <span>
                        {completedCards}/{totalCards} Cards Concluídos
                    </span>
                </div>
                <div className={styles.progressTrack}>
                    <div
                        className={styles.progressFill}
                        style={{ width: `${weekPercentage}%` }}
                    />
                </div>
                <div className={styles.progressFooter}>
                    <span>Progresso da Semana</span>
                    <strong>{weekPercentage}%</strong>
                </div>
            </section>

            {errorMessage && <p className={styles.errorBanner}>{errorMessage}</p>}
            {xpGainMessage && (
                <p className={styles.xpBanner}>
                    <i className="fas fa-sparkles"></i>
                    {xpGainMessage}
                </p>
            )}

            <nav
                className={styles.daysNav}
                style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            >
                {days.map((day) => (
                    <button
                        key={day.dayNum}
                        type="button"
                        onClick={() => setActiveDay(day.dayNum)}
                        className={`${styles.dayBtn} ${activeDay === day.dayNum ? styles.dayBtnActive : ""}`}
                    >
                        DIA {day.dayNum}
                    </button>
                ))}
            </nav>

            {currentDay && (
                <section className={styles.cardsSection}>
                    <div className={styles.dayHeader}>
                        <h3>Dia {currentDay.dayNum}</h3>
                        <span>{currentDay.cards.length} Atividades</span>
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
                                                    !!embedUrl &&
                                                    activeVideo?.cardId === card.cardId &&
                                                    activeVideo.embedUrl === embedUrl;

                                                if (isVideo && embedUrl) {
                                                    return (
                                                        <button
                                                            key={`${card.cardId}-link-${index}`}
                                                            type="button"
                                                            className={`${styles.cardLink} ${styles.videoTrigger} ${isSelected ? styles.videoTriggerActive : ""}`}
                                                            onClick={() =>
                                                                handleVideoToggle(
                                                                    card.cardId,
                                                                    card.title,
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

                                    {activeVideo?.cardId === card.cardId && (
                                        <div className={styles.videoEmbedWrap}>
                                            <div className={styles.videoControlPanel}>
                                                <div className={styles.videoTimelineRow}>
                                                    <span className={styles.videoTimeLabel}>
                                                        {formatSeconds(activeCurrentTime)}
                                                    </span>
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={100}
                                                        step={0.1}
                                                        value={Math.max(
                                                            0,
                                                            Math.min(100, activeProgressPercent)
                                                        )}
                                                        onChange={(event) =>
                                                            handleTimelineChange(
                                                                Number(event.target.value)
                                                            )
                                                        }
                                                        className={styles.videoTimeline}
                                                        aria-label="Barra de Progresso do Vídeo"
                                                    />
                                                    <span className={styles.videoTimeLabel}>
                                                        {formatSeconds(activeDuration)}
                                                    </span>
                                                </div>

                                                <div className={styles.videoControlGroup}>
                                                    <button
                                                        type="button"
                                                        className={styles.videoControlBtn}
                                                        onClick={handlePlayPause}
                                                    >
                                                        <i
                                                            className={`fas ${isActivePlaying ? "fa-pause" : "fa-play"}`}
                                                        ></i>
                                                        {isActivePlaying ? "Pausar" : "Reproduzir"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={styles.videoControlBtn}
                                                        onClick={() => handleSeek(-10)}
                                                        title="Voltar 10 segundos"
                                                        aria-label="Voltar 10 segundos"
                                                    >
                                                        <i className="fas fa-angles-left"></i>
                                                        10s
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={styles.videoControlBtn}
                                                        onClick={() => handleSeek(10)}
                                                        title="Avançar 10 segundos"
                                                        aria-label="Avançar 10 segundos"
                                                    >
                                                        <i className="fas fa-angles-right"></i>
                                                        10s
                                                    </button>
                                                </div>

                                                <div className={styles.videoSpeedGroup}>
                                                    {[1.2, 1.5, 2].map((rate) => (
                                                        <button
                                                            key={rate}
                                                            type="button"
                                                            className={`${styles.videoSpeedBtn} ${Math.abs(activePlaybackRate - rate) < 0.01 ? styles.videoSpeedActive : ""}`}
                                                            onClick={() => handleSpeed(rate)}
                                                        >
                                                            {rate}x
                                                        </button>
                                                    ))}

                                                    <button
                                                        type="button"
                                                        className={`${styles.videoControlBtn} ${styles.videoCloseBtn}`}
                                                        onClick={() => setActiveVideo(null)}
                                                    >
                                                        Fechar
                                                    </button>
                                                </div>
                                            </div>

                                            <div
                                                className={styles.videoFrame}
                                                onContextMenu={(event) =>
                                                    event.preventDefault()
                                                }
                                            >
                                                <div className={styles.videoViewport}>
                                                    <iframe
                                                        id={activeVideo.playerId}
                                                        src={activeVideo.embedUrl}
                                                        title={`${activeVideo.title} - video`}
                                                        loading="lazy"
                                                        allow="autoplay; encrypted-media; picture-in-picture"
                                                        allowFullScreen={false}
                                                        referrerPolicy="strict-origin-when-cross-origin"
                                                        sandbox="allow-scripts allow-same-origin allow-presentation"
                                                        onLoad={() =>
                                                            initVideoPlayer(
                                                                activeVideo.playerId
                                                            )
                                                        }
                                                    />
                                                    <span
                                                        className={styles.videoClickShieldTop}
                                                    ></span>
                                                    <span
                                                        className={styles.videoClickShieldBottom}
                                                    ></span>
                                                    {showPauseOverlay && (
                                                        <button
                                                            type="button"
                                                            className={styles.videoPauseOverlay}
                                                            onClick={handlePlayPause}
                                                            aria-label="Reproduzir Vídeo"
                                                        >
                                                            <span
                                                                className={styles.videoPauseOverlayIcon}
                                                            >
                                                                <i className="fas fa-play"></i>
                                                            </span>
                                                        </button>
                                                    )}
                                                    <span className={styles.videoWatermark}>
                                                        EA Premium Player
                                                    </span>
                                                </div>
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
                    <i className="fas fa-arrow-left"></i> Voltar ao Dashboard
                </Link>
                <div className={styles.weekNavLinks}>
                    {weekNum > 1 && (
                        <Link
                            href={`/dashboard/semana/${weekNum - 1}`}
                            className={styles.weekNavButton}
                        >
                            Semana Anterior
                        </Link>
                    )}
                    {weekNum < TOTAL_WEEKS && (
                        <Link
                            href={`/dashboard/semana/${weekNum + 1}`}
                            className={`${styles.weekNavButton} ${styles.weekNavPrimary}`}
                        >
                            Próxima Semana
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
