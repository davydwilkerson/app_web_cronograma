import type { CSSProperties } from "react";
import type { GamificationSnapshot, GamificationWeekJourneyNode } from "@/types/gamification";
import styles from "./GamificationPanel.module.css";

interface GamificationPanelProps {
  snapshot: GamificationSnapshot;
  variant?: "full" | "compact";
}

interface JourneyPhase {
  upToWeek: number;
  label: string;
  brief: string;
  icon: string;
  colorA: string;
  colorB: string;
  glow: string;
}

const JOURNEY_PHASES: JourneyPhase[] = [
  {
    upToWeek: 4,
    label: "Triagem",
    brief: "Ajuste de ritmo, leitura clinica e base forte.",
    icon: "fa-stethoscope",
    colorA: "#4ec7d6",
    colorB: "#3a75c7",
    glow: "rgba(78, 199, 214, 0.18)",
  },
  {
    upToWeek: 8,
    label: "Base Assistencial",
    brief: "Protocolos, fundamentos e seguranca de conduta.",
    icon: "fa-notes-medical",
    colorA: "#14835f",
    colorB: "#56c89a",
    glow: "rgba(20, 131, 95, 0.18)",
  },
  {
    upToWeek: 12,
    label: "Rotina de Plantao",
    brief: "Ritmo de execucao, disciplina e constancia de estudo.",
    icon: "fa-briefcase-medical",
    colorA: "#3a75c7",
    colorB: "#4ec7d6",
    glow: "rgba(58, 117, 199, 0.18)",
  },
  {
    upToWeek: 16,
    label: "Conduta Segura",
    brief: "Tomada de decisao, revisao e leitura de prova.",
    icon: "fa-heartbeat",
    colorA: "#ce9545",
    colorB: "#f1c46d",
    glow: "rgba(206, 149, 69, 0.2)",
  },
  {
    upToWeek: 20,
    label: "Reta de Alta",
    brief: "Aceleracao final, revisao forte e ajuste fino.",
    icon: "fa-bolt",
    colorA: "#d1664f",
    colorB: "#ce9545",
    glow: "rgba(209, 102, 79, 0.18)",
  },
  {
    upToWeek: 24,
    label: "Mapa de Aprovacao",
    brief: "Performance final para chegar pronto na aprovacao.",
    icon: "fa-award",
    colorA: "#ce9545",
    colorB: "#4ec7d6",
    glow: "rgba(229, 178, 113, 0.2)",
  },
];

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

function groupJourneyRows(
  nodes: GamificationWeekJourneyNode[],
  rowSize: number
): GamificationWeekJourneyNode[][] {
  const rows: GamificationWeekJourneyNode[][] = [];

  for (let index = 0; index < nodes.length; index += rowSize) {
    rows.push(nodes.slice(index, index + rowSize));
  }

  return rows;
}

function getJourneyPhase(weekNum: number): JourneyPhase {
  return JOURNEY_PHASES.find((phase) => weekNum <= phase.upToWeek) || JOURNEY_PHASES[JOURNEY_PHASES.length - 1];
}

function getPhaseStyle(phase: JourneyPhase): CSSProperties {
  return {
    ["--phase-a" as string]: phase.colorA,
    ["--phase-b" as string]: phase.colorB,
    ["--phase-glow" as string]: phase.glow,
  };
}

function getJourneyNodeState(week: GamificationWeekJourneyNode, phase: JourneyPhase): {
  tone: "current" | "done" | "started" | "planned" | "empty";
  label: string;
  helper: string;
  footnote: string;
} {
  if (week.isCurrent) {
    return {
      tone: "current",
      label: "Plantao atual",
      helper: `${phase.label}: ${phase.brief}`,
      footnote: "Missao principal do momento",
    };
  }

  if (week.percentage >= 100) {
    return {
      tone: "done",
      label: "Plantao fechado",
      helper: `${phase.label} concluida com checklist entregue.`,
      footnote: "Etapa clinica encerrada",
    };
  }

  if (week.completedCards > 0) {
    return {
      tone: "started",
      label: "Missao ativa",
      helper: `${phase.label} em andamento com progresso iniciado.`,
      footnote: "Continue o plantao",
    };
  }

  if (week.totalCards > 0) {
    return {
      tone: "planned",
      label: "Na fila",
      helper: `${phase.label} sera a proxima estacao da trilha clinica.`,
      footnote: "Proximo plantao",
    };
  }

  return {
    tone: "empty",
    label: "Aguardando",
    helper: `Conteudo da fase ${phase.label} ainda nao foi carregado.`,
    footnote: "Sem cards no banco",
  };
}

function getStopToneClass(
  tone: ReturnType<typeof getJourneyNodeState>["tone"]
): string {
  switch (tone) {
    case "current":
      return styles.stopCurrent;
    case "done":
      return styles.stopDone;
    case "started":
      return styles.stopStarted;
    case "planned":
      return styles.stopPlanned;
    default:
      return styles.stopEmpty;
  }
}

export default function GamificationPanel({
  snapshot,
  variant = "full",
}: GamificationPanelProps) {
  const compact = variant === "compact";
  const achievements = compact ? snapshot.achievements.slice(0, 6) : snapshot.achievements;
  const journey = journeySlice(snapshot.weekJourney, snapshot.currentWeek, variant);
  const roadRows = groupJourneyRows(journey, compact ? 3 : 4);
  const dailyCompleted = snapshot.dailyMissions.filter((mission) => mission.completed).length;
  const completedWeeks = snapshot.weekJourney.filter((week) => week.percentage >= 100).length;
  const weeksInProgress = snapshot.weekJourney.filter(
    (week) => week.completedCards > 0 && week.percentage < 100
  ).length;
  const activeJourneyWeek =
    snapshot.weekJourney.find((week) => week.isCurrent) ||
    snapshot.weekJourney.find((week) => week.completedCards > 0) ||
    snapshot.weekJourney[0];
  const remainingWeeks = Math.max(0, snapshot.weekJourney.length - completedWeeks);
  const activePhase = getJourneyPhase(activeJourneyWeek?.weekNum || snapshot.currentWeek);
  const activePhaseStyle = getPhaseStyle(activePhase);
  const activeWeekState = activeJourneyWeek
    ? getJourneyNodeState(activeJourneyWeek, activePhase)
    : {
        tone: "planned" as const,
        label: "Na fila",
        helper: "A proxima fase da trilha esta pronta para iniciar.",
        footnote: "Proximo plantao",
      };

  return (
    <section className={`${styles.panel} ${compact ? styles.compact : ""}`}>
      <div className={styles.hero}>
        <div>
          <p className={styles.kicker}>Gamificacao Ativa</p>
          <h2>Missao diaria, trilha clinica e mapa de aprovacao</h2>
        </div>
        <div className={styles.levelChip}>
          <span>
            {snapshot.balanceLabel} | Nivel {snapshot.level.level}
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
            : `${snapshot.level.currentXp} XP (Nivel Maximo)`}
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
              Missoes do Dia
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
                <li
                  key={`${entry.userId}-${entry.rank}`}
                  className={entry.isCurrentUser ? styles.me : ""}
                >
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
              Mapa de Aprovacao
            </h3>
            <span>Trilha clinica | 24 semanas</span>
          </header>

          <div className={styles.journeyHero}>
            <div className={styles.journeyLead} style={activePhaseStyle}>
              <div className={styles.journeyThemePill}>
                <i className={`fas ${activePhase.icon}`}></i>
                <span>{activePhase.label}</span>
              </div>
              <p className={styles.journeyLeadLabel}>Plantao Atual</p>
              <strong>
                Semana {activeJourneyWeek?.weekNum || snapshot.currentWeek} | {activeWeekState.label}
              </strong>
              <p>
                {activeJourneyWeek?.totalCards
                  ? `${activeJourneyWeek.completedCards} de ${activeJourneyWeek.totalCards} cards concluidos nesta etapa. ${activePhase.brief}`
                  : "Esta semana ainda nao tem cards carregados no banco."}
              </p>
            </div>

            <div className={styles.journeyStats}>
              <div className={styles.journeyStat}>
                <span>Plantoes Fechados</span>
                <strong>{completedWeeks}</strong>
              </div>
              <div className={styles.journeyStat}>
                <span>Missoes Ativas</span>
                <strong>{weeksInProgress}</strong>
              </div>
              <div className={styles.journeyStat}>
                <span>Ate a Aprovacao</span>
                <strong>{remainingWeeks}</strong>
              </div>
            </div>
          </div>

          <div className={styles.journeyLegend}>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.legendCurrent}`}></i>
              Plantao atual
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.legendDone}`}></i>
              Plantao fechado
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.legendStarted}`}></i>
              Missao ativa
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.legendPlanned}`}></i>
              Proximo plantao
            </span>
          </div>

          <div className={styles.journeyRoad}>
            {roadRows.map((row, rowIndex) => {
              const isLastRow = rowIndex === roadRows.length - 1;
              const displayRow = rowIndex % 2 === 1 ? [...row].reverse() : row;
              const bridgeClass = !isLastRow
                ? rowIndex % 2 === 0
                  ? styles.bridgeRight
                  : styles.bridgeLeft
                : "";
              const rowStyle: CSSProperties = {
                ["--road-columns" as string]: String(displayRow.length),
              };

              return (
                <div
                  key={`journey-row-${rowIndex}`}
                  className={`${styles.roadRow} ${bridgeClass}`}
                  style={rowStyle}
                >
                  {displayRow.map((week) => {
                    const phase = getJourneyPhase(week.weekNum);
                    const journeyState = getJourneyNodeState(week, phase);
                    const phaseStyle = getPhaseStyle(phase);

                    return (
                      <article
                        key={week.weekNum}
                        className={`${styles.roadStop} ${getStopToneClass(journeyState.tone)}`}
                        style={phaseStyle}
                        title={`Semana ${week.weekNum} - ${week.percentage}%`}
                      >
                        <div className={styles.stopMarkerWrap}>
                          <span className={styles.stopPulse}></span>
                          <span className={styles.stopMarker}>
                            {String(week.weekNum).padStart(2, "0")}
                          </span>
                        </div>

                        <div className={styles.stopCard}>
                          <div className={styles.stopCardHead}>
                            <div className={styles.stopTheme}>
                              <span className={styles.stopWeekLabel}>Semana {week.weekNum}</span>
                              <span className={styles.phasePill}>
                                <i className={`fas ${phase.icon}`}></i>
                                <span>{phase.label}</span>
                              </span>
                            </div>
                            <strong className={styles.stopStatus}>{journeyState.label}</strong>
                          </div>

                          <p className={styles.stopDescription}>{journeyState.helper}</p>

                          <div className={styles.stopNumbers}>
                            <strong>{week.percentage}%</strong>
                            <span>
                              {week.totalCards > 0
                                ? `${week.completedCards}/${week.totalCards} cards`
                                : "Sem cards"}
                            </span>
                          </div>

                          <div className={styles.stopProgress}>
                            <span style={{ width: `${week.percentage}%` }} />
                          </div>

                          <small className={styles.stopFootnote}>
                            {journeyState.footnote}
                          </small>
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}
