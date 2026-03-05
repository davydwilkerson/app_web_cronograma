import type { GamificationSnapshot, GamificationWeekJourneyNode } from "@/types/gamification";
import styles from "./GamificationPanel.module.css";

interface GamificationPanelProps {
  snapshot: GamificationSnapshot;
  variant?: "full" | "compact";
}

function pct(progress: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
}

function journeySlice(
  nodes: GamificationWeekJourneyNode[],
  currentWeek: number,
  variant: "full" | "compact"
): GamificationWeekJourneyNode[] {
  if (variant === "full") {
    return nodes;
  }

  const from = Math.max(0, currentWeek - 7);
  const to = Math.min(nodes.length, from + 12);
  return nodes.slice(from, to);
}

export default function GamificationPanel({
  snapshot,
  variant = "full",
}: GamificationPanelProps) {
  const compact = variant === "compact";
  const achievements = compact ? snapshot.achievements.slice(0, 6) : snapshot.achievements;
  const journey = journeySlice(snapshot.weekJourney, snapshot.currentWeek, variant);
  const dailyCompleted = snapshot.dailyMissions.filter((mission) => mission.completed).length;

  return (
    <section className={`${styles.panel} ${compact ? styles.compact : ""}`}>
      <div className={styles.hero}>
        <div>
          <p className={styles.kicker}>GamificaÃ§Ã£o Ativa</p>
          <h2>Ritmo, Recompensa e EvoluÃ§Ã£o</h2>
        </div>
        <div className={styles.levelChip}>
          <span>
            {snapshot.balanceLabel} | NÃ­vel {snapshot.level.level}
          </span>
          <strong>{snapshot.level.title}</strong>
        </div>
      </div>

      <div className={styles.levelTrackWrap}>
        <div className={styles.levelTrack}>
          <span style={{ width: `${snapshot.level.progressPct}%` }} />
        </div>
        <small>
          {snapshot.level.nextLevelXp
            ? `${snapshot.level.currentXp} XP / ${snapshot.level.nextLevelXp} XP`
            : `${snapshot.level.currentXp} XP (NÃ­vel MÃ¡ximo)`}
        </small>
      </div>

      <div className={styles.metrics}>
        <article className={styles.metricCard}>
          <span>XP Total</span>
          <strong>{snapshot.totalXp}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Streak</span>
          <strong>{snapshot.streak} dias</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Combo Hoje</span>
          <strong>{snapshot.todayFocusCombo}x</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Moedas</span>
          <strong>{snapshot.coins}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Ranking</span>
          <strong>{snapshot.userRank ? `#${snapshot.userRank}` : "-"}</strong>
        </article>
      </div>

      <div className={styles.grid}>
        <article className={styles.block}>
          <header>
            <h3>
              <i className="fas fa-flag-checkered"></i>
              MissÃµes do Dia
            </h3>
            <span>
              {dailyCompleted}/{snapshot.dailyMissions.length}
            </span>
          </header>
          <ul className={styles.missionList}>
            {snapshot.dailyMissions.map((mission) => (
              <li key={mission.id} className={mission.completed ? styles.missionDone : ""}>
                <div className={styles.missionHead}>
                  <strong>{mission.title}</strong>
                  <span>
                    {mission.progress}/{mission.target}
                  </span>
                </div>
                <p>{mission.description}</p>
                <div className={styles.progressTrack}>
                  <span style={{ width: `${pct(mission.progress, mission.target)}%` }} />
                </div>
                <small>
                  +{mission.rewardXp} XP | +{mission.rewardCoins} moedas
                </small>
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.block}>
          <header>
            <h3>
              <i className="fas fa-dragon"></i>
              Boss Semanal
            </h3>
            <span>S{snapshot.weeklyBoss.weekNum}</span>
          </header>
          <div className={styles.bossCard}>
            <p>{snapshot.weeklyBoss.title}</p>
            <strong>
              {snapshot.weeklyBoss.progress}/{snapshot.weeklyBoss.target}
            </strong>
            <div className={styles.progressTrack}>
              <span
                style={{
                  width: `${pct(snapshot.weeklyBoss.progress, snapshot.weeklyBoss.target)}%`,
                }}
              />
            </div>
            <small>
              Recompensa: +{snapshot.weeklyBoss.rewardXp} XP | +{snapshot.weeklyBoss.rewardCoins} moedas
            </small>
          </div>
          <div className={[styles.bossCard, styles.chestCard].join(" ")}>
            <div className={styles.chestRow}>
              <div>
                <p>Baú Semanal</p>
                <small>
                  Streak {snapshot.surpriseChest.currentStreak}/{snapshot.surpriseChest.requiredStreak}
                </small>
              </div>
              <span className={`${styles.chestStatus} ${snapshot.surpriseChest.ready ? styles.ready : ""}`}>
                {snapshot.surpriseChest.ready ? "Pronto para Abrir" : "Em Progresso"}
              </span>
            </div>
            <div className={styles.progressTrack}>
              <span style={{ width: `${snapshot.surpriseChest.progressPct}%` }} />
            </div>
            <small>{snapshot.surpriseChest.rewardLabel}</small>
          </div>
        </article>

        <article className={styles.block}>
          <header>
            <h3>
              <i className="fas fa-trophy"></i>
              Conquistas
            </h3>
            <span>
              {snapshot.achievements.filter((achievement) => achievement.unlocked).length}/
              {snapshot.achievements.length}
            </span>
          </header>
          <div className={styles.badges}>
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`${styles.badge} ${achievement.unlocked ? styles.badgeOn : ""}`}
                title={achievement.description}
              >
                <i className={`fas ${achievement.icon}`}></i>
                <strong>{achievement.title}</strong>
                <span>{achievement.unlocked ? "Desbloqueado" : "Bloqueado"}</span>
              </div>
            ))}
          </div>
        </article>

        {!compact && (
          <article className={styles.block}>
            <header>
              <h3>
                <i className="fas fa-ranking-star"></i>
                Ranking Semanal
              </h3>
              <span>Top Jogadores</span>
            </header>
            <ol className={styles.rankList}>
              {snapshot.leaderboard.map((entry) => (
                <li key={`${entry.userId}-${entry.rank}`} className={entry.isCurrentUser ? styles.me : ""}>
                  <span>#{entry.rank}</span>
                  <strong>{entry.displayName}</strong>
                  <small>{entry.xp} XP</small>
                </li>
              ))}
            </ol>
          </article>
        )}

        <article className={`${styles.block} ${styles.journeyBlock}`}>
          <header>
            <h3>
              <i className="fas fa-route"></i>
              Mapa da Jornada
            </h3>
            <span>24 Semanas</span>
          </header>
          <div className={styles.journeyGrid}>
            {journey.map((week) => (
              <div
                key={week.weekNum}
                className={`${styles.journeyNode} ${
                  week.percentage >= 100
                    ? styles.done
                    : week.completedCards > 0
                      ? styles.started
                      : ""
                } ${week.isCurrent ? styles.current : ""}`}
                title={`Semana ${week.weekNum} - ${week.percentage}%`}
              >
                <span>S{week.weekNum}</span>
                <strong>{week.percentage}%</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
