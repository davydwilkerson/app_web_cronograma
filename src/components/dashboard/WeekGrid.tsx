"use client";

import { useRouter } from "next/navigation";
import styles from "./WeekGrid.module.css";

interface WeekData {
    week_num: number;
    total_cards: number;
    completed_cards: number;
    percentage: number;
    locked: boolean;
}

interface WeekGridProps {
    weeks: WeekData[];
}

export default function WeekGrid({ weeks }: WeekGridProps) {
    const router = useRouter();

    function handleWeekClick(week: WeekData) {
        if (week.locked) {
            alert("Esta semana está bloqueada no modo trial. Assine para liberar.");
            return;
        }
        router.push(`/dashboard/semana/${week.week_num}`);
    }

    function getStatusClass(pct: number): string {
        if (pct === 0) return styles.notStarted;
        if (pct < 50) return styles.inProgress1;
        if (pct < 100) return styles.inProgress2;
        return styles.completed;
    }

    return (
        <div className={styles.grid}>
            {weeks.map((week) => (
                <button
                    key={week.week_num}
                    className={`${styles.weekCard} ${week.locked ? styles.locked : ""} ${getStatusClass(week.percentage)}`}
                    onClick={() => handleWeekClick(week)}
                    id={`week-${week.week_num}`}
                    disabled={week.locked}
                >
                    {week.locked && (
                        <div className={styles.lockOverlay}>
                            <i className="fas fa-lock"></i>
                        </div>
                    )}

                    <div className={styles.weekNumber}>S{week.week_num}</div>

                    <div className={styles.progressRing}>
                        <svg viewBox="0 0 36 36" className={styles.ringSvg}>
                            <path
                                className={styles.ringBg}
                                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                strokeWidth="3"
                            />
                            <path
                                className={styles.ringFill}
                                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                strokeWidth="3"
                                strokeDasharray={`${week.percentage}, 100`}
                            />
                        </svg>
                        <span className={styles.ringText}>{week.percentage}%</span>
                    </div>

                    <div className={styles.weekLabel}>Semana {week.week_num}</div>
                    <div className={styles.cardCount}>
                        {week.completed_cards}/{week.total_cards} Cards
                    </div>
                </button>
            ))}
        </div>
    );
}
