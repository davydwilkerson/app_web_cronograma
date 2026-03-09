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
  ward: string;
  brief: string;
  icon: string;
  colorA: string;
  colorB: string;
  glow: string;
}

const JOURNEY_PHASES: JourneyPhase[] = [
  {
    upToWeek: 4,
    label: "Estado gravissimo",
    ward: "Sala Vermelha",
    brief: "Chegou sem metodo, sem rotina e sem leitura de prova. O foco agora e sobreviver ao caos do estudo.",
    icon: "fa-ambulance",
    colorA: "#b84747",
    colorB: "#d1664f",
    glow: "rgba(184, 71, 71, 0.2)",
  },
  {
    upToWeek: 8,
    label: "Estado grave",
    ward: "UTI do Cronograma",
    brief: "Ja responde aos primeiros protocolos, mas ainda exige intervencao forte de rotina e disciplina.",
    icon: "fa-heartbeat",
    colorA: "#d1664f",
    colorB: "#ce9545",
    glow: "rgba(209, 102, 79, 0.2)",
  },
  {
    upToWeek: 12,
    label: "Quadro delicado",
    ward: "Monitorizacao Intensiva",
    brief: "Os sinais vitais do estudo melhoram. Revisao, execucao e constancia comecam a estabilizar.",
    icon: "fa-notes-medical",
    colorA: "#ce9545",
    colorB: "#f1c46d",
    glow: "rgba(206, 149, 69, 0.22)",
  },
  {
    upToWeek: 16,
    label: "Estavel sob observacao",
    ward: "Observacao Clinica",
    brief: "O aluno passa a estudar com mais seguranca, leitura melhor da prova e menos oscilacao.",
    icon: "fa-stethoscope",
    colorA: "#3a75c7",
    colorB: "#4ec7d6",
    glow: "rgba(58, 117, 199, 0.18)",
  },
  {
    upToWeek: 20,
    label: "Recuperacao assistida",
    ward: "Enfermaria de Revisao",
    brief: "O conteudo circula melhor. Simulados, revisoes e conduta de prova ficam mais firmes.",
    icon: "fa-briefcase-medical",
    colorA: "#14835f",
    colorB: "#56c89a",
    glow: "rgba(20, 131, 95, 0.18)",
  },
  {
    upToWeek: 24,
    label: "Alta para aprovacao",
    ward: "Protocolo de Alta",
    brief: "Paciente academico pronto para sair da unidade e enfrentar a prova com autonomia.",
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
      label: "Em atendimento",
      helper: `${phase.ward} | ${phase.label}. ${phase.brief}`,
      footnote: "Paciente em atendimento agora",
    };
  }

  if (week.percentage >= 100) {
    return {
      tone: "done",
      label: "Quadro revertido",
      helper: `${phase.ward} liberada. ${phase.label} passou pelo protocolo com sucesso.`,
      footnote: "Liberado da ala",
    };
  }

  if (week.completedCards > 0) {
    return {
      tone: "started",
      label: "Em tratamento",
      helper: `${phase.ward} em acompanhamento. O quadro ja responde ao protocolo de estudo.`,
      footnote: "Monitorizacao ativa",
    };
  }

  if (week.totalCards > 0) {
    return {
      tone: "planned",
      label: "Aguardando triagem",
      helper: `${phase.ward} sera a proxima unidade. Ainda nao iniciou essa conduta.`,
      footnote: "Proxima entrada clinica",
    };
  }

  return {
    tone: "empty",
    label: "Sem prontuario",
    helper: `Ainda nao ha prontuario clinico da fase ${phase.label} no banco.`,
    footnote: "Sem registro de protocolo",
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
        footnote: "Proxima entrada clinica",
      };

  return (
    <section className={`${styles.panel} ${compact ? styles.compact : ""}`}>
      <div className={styles.hero}>
        <div>
          <p className={styles.kicker}>Gamificacao Ativa</p>
          <h2>Paciente academico em protocolo de alta rumo a aprovacao</h2>
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
              Protocolo Clinico da Aprovacao
            </h3>
            <span>Da sala vermelha a alta | 24 semanas</span>
          </header>

          <div className={styles.journeyHero}>
            <div className={styles.journeyLead} style={activePhaseStyle}>
              <div className={styles.journeyThemePill}>
                <i className={`fas ${activePhase.icon}`}></i>
                <span>{activePhase.ward}</span>
              </div>
              <p className={styles.journeyLeadLabel}>Boletim Clinico Atual</p>
              <strong>
                Semana {activeJourneyWeek?.weekNum || snapshot.currentWeek} | {activeWeekState.label}
              </strong>
              <p>
                {activeJourneyWeek?.totalCards
                  ? `${activePhase.label}. ${activeJourneyWeek.completedCards} de ${activeJourneyWeek.totalCards} cards concluidos nesta etapa. ${activePhase.brief}`
                  : "Esta semana ainda nao tem cards carregados no banco."}
              </p>
            </div>

            <div className={styles.journeyStats}>
              <div className={styles.journeyStat}>
                <span>Quadros Revertidos</span>
                <strong>{completedWeeks}</strong>
              </div>
              <div className={styles.journeyStat}>
                <span>Em Tratamento</span>
                <strong>{weeksInProgress}</strong>
              </div>
              <div className={styles.journeyStat}>
                <span>Semanas Ate Alta</span>
                <strong>{remainingWeeks}</strong>
              </div>
            </div>
          </div>

          <div className={styles.journeyLegend}>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.legendCurrent}`}></i>
              Em atendimento
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.legendDone}`}></i>
              Quadro revertido
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.legendStarted}`}></i>
              Em tratamento
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.legendPlanned}`}></i>
              Aguardando triagem
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
                                <span>{phase.ward}</span>
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
