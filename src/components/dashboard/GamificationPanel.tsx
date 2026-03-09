import type { CSSProperties } from "react";
import type { GamificationSnapshot, GamificationWeekJourneyNode } from "@/types/gamification";
import styles from "./GamificationPanel.module.css";

interface GamificationPanelProps {
  snapshot: GamificationSnapshot;
  currentUserName?: string;
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
    upToWeek: 1,
    label: "Estado gravissimo",
    ward: "Sala Vermelha",
    brief: "Chega sem metodo, sem rotina e sem leitura de prova. O objetivo e sair do colapso do estudo.",
    icon: "fa-ambulance",
    colorA: "#b90f2d",
    colorB: "#ef3b56",
    glow: "rgba(239, 59, 86, 0.22)",
  },
  {
    upToWeek: 2,
    label: "Estado grave",
    ward: "UTI do Cronograma",
    brief: "Ja entrou no protocolo, mas ainda depende de intervencao forte para ganhar ritmo e constancia.",
    icon: "fa-heartbeat",
    colorA: "#c9263c",
    colorB: "#f36d7b",
    glow: "rgba(243, 109, 123, 0.22)",
  },
  {
    upToWeek: 3,
    label: "Quadro delicado",
    ward: "Monitorizacao Intensiva",
    brief: "Os sinais vitais do estudo melhoram. Revisao, execucao e disciplina comecam a responder.",
    icon: "fa-notes-medical",
    colorA: "#de6b11",
    colorB: "#f6a23d",
    glow: "rgba(246, 162, 61, 0.22)",
  },
  {
    upToWeek: 4,
    label: "Sinais de estabilizacao",
    ward: "Observacao Clinica",
    brief: "O aluno respira melhor dentro do cronograma e ja sustenta uma rotina mais segura.",
    icon: "fa-stethoscope",
    colorA: "#d19c11",
    colorB: "#f1ce5f",
    glow: "rgba(241, 206, 95, 0.22)",
  },
  {
    upToWeek: 8,
    label: "Estabilizacao assistida",
    ward: "Enfermaria de Estabilizacao",
    brief: "A rotina ainda precisa de observacao, mas ja existe resposta constante aos protocolos.",
    icon: "fa-procedures",
    colorA: "#a9a81a",
    colorB: "#d9dc57",
    glow: "rgba(217, 220, 87, 0.2)",
  },
  {
    upToWeek: 12,
    label: "Recuperacao assistida",
    ward: "Enfermaria de Revisao",
    brief: "Conteudo em circulacao, revisao forte e mais dominio nas decisoes de prova.",
    icon: "fa-briefcase-medical",
    colorA: "#78a61f",
    colorB: "#a9d94a",
    glow: "rgba(169, 217, 74, 0.22)",
  },
  {
    upToWeek: 16,
    label: "Recuperacao consistente",
    ward: "Ala de Consolidacao",
    brief: "O aluno ja responde bem ao tratamento, com revisao, prova e leitura muito mais maduras.",
    icon: "fa-clipboard-check",
    colorA: "#4b9e24",
    colorB: "#72d25c",
    glow: "rgba(114, 210, 92, 0.22)",
  },
  {
    upToWeek: 20,
    label: "Pre-alta monitorada",
    ward: "Protocolo de Alta Assistida",
    brief: "Fase de consolidar o quadro e evitar recaidas na disciplina e na revisao.",
    icon: "fa-user-md",
    colorA: "#219152",
    colorB: "#4fd183",
    glow: "rgba(79, 209, 131, 0.22)",
  },
  {
    upToWeek: 24,
    label: "Alta para aprovacao",
    ward: "Protocolo de Alta",
    brief: "Paciente academico pronto para sair da unidade e enfrentar a prova com autonomia.",
    icon: "fa-award",
    colorA: "#0f7a3d",
    colorB: "#18c35f",
    glow: "rgba(24, 195, 95, 0.24)",
  },
];

function pct(progress: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
}

function getJourneyWindow(nodes: GamificationWeekJourneyNode[]): GamificationWeekJourneyNode[] {
  const windowSize = 4;
  if (nodes.length <= windowSize) {
    return nodes;
  }

  let leadingCompleted = 0;
  for (const node of nodes) {
    if (node.percentage >= 100) {
      leadingCompleted += 1;
      continue;
    }
    break;
  }

  const start = Math.max(0, Math.min(nodes.length - windowSize, leadingCompleted - (windowSize - 1)));
  return nodes.slice(start, start + windowSize);
}

function getJourneyPhase(weekNum: number): JourneyPhase {
  return (
    JOURNEY_PHASES.find((phase) => weekNum <= phase.upToWeek) ||
    JOURNEY_PHASES[JOURNEY_PHASES.length - 1]
  );
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
      helper: `${phase.label}. ${phase.brief}`,
      footnote: "Paciente em atendimento agora",
    };
  }

  if (week.percentage >= 100) {
    return {
      tone: "done",
      label: "Quadro revertido",
      helper: `${phase.ward} concluida com resposta clinica positiva ao protocolo.`,
      footnote: "Liberado da ala",
    };
  }

  if (week.completedCards > 0) {
    return {
      tone: "started",
      label: "Em tratamento",
      helper: `${phase.ward} em andamento. O quadro ja responde ao tratamento de estudo.`,
      footnote: "Monitorizacao ativa",
    };
  }

  if (week.totalCards > 0) {
    return {
      tone: "planned",
      label: "Aguardando triagem",
      helper: `${phase.ward} sera a proxima etapa do protocolo clinico conforme o aluno avancar.`,
      footnote: "Proxima entrada clinica",
    };
  }

  return {
    tone: "empty",
    label: "Sem prontuario",
    helper: `Ainda nao ha registro clinico da fase ${phase.label} no banco.`,
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

function getReadableMissionTitle(missionId: string, fallback: string): string {
  switch (missionId) {
    case "daily-cards":
      return "Meta de Cards do Dia";
    case "daily-touch":
      return "Ritmo de Estudo";
    case "daily-xp":
      return "Meta de Pontos";
    default:
      return fallback;
  }
}

function getReadableMissionDescription(
  missionId: string,
  target: number,
  fallback: string
): string {
  switch (missionId) {
    case "daily-cards":
      return `Concluir ${target} card(s) hoje`;
    case "daily-touch":
      return `Avancar em ${target} card(s) ao longo do dia`;
    case "daily-xp":
      return `Somar ${target} pontos hoje`;
    default:
      return fallback;
  }
}

function getReadableAchievementTitle(achievementId: string, fallback: string): string {
  switch (achievementId) {
    case "first-blood":
      return "Primeiro Passo";
    case "combo-runner":
      return "Ritmo Forte no Dia";
    case "streak-3":
      return "Constancia 3 Dias";
    case "streak-7":
      return "7 Dias Seguidos";
    case "week-master":
      return "Semana Concluida";
    case "half-journey":
      return "Varias Semanas Iniciadas";
    case "centurion":
      return "Muitos Cards Concluidos";
    case "marathon":
      return "Dia Perfeito";
    case "xp-legend":
      return "Pontuacao de Destaque";
    default:
      return fallback;
  }
}

function getReadableAchievementDescription(
  achievementId: string,
  fallback: string
): string {
  switch (achievementId) {
    case "first-blood":
      return "Concluiu o primeiro card.";
    case "combo-runner":
      return "Teve um dia forte de estudo e avancou em varios cards.";
    case "streak-3":
      return "Manteve 3 dias seguidos de estudo.";
    case "streak-7":
      return "Manteve 7 dias seguidos de estudo.";
    case "week-master":
      return "Finalizou uma semana completa.";
    case "half-journey":
      return "Ja iniciou varias semanas do cronograma.";
    case "centurion":
      return "Concluiu uma grande quantidade de cards.";
    case "marathon":
      return "Teve um dia de estudo com alto rendimento.";
    case "xp-legend":
      return "Ultrapassou uma pontuacao alta no cronograma.";
    default:
      return fallback;
  }
}

function toDisplayNameToken(value: string): string {
  if (!value) return "";
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1).toLocaleLowerCase("pt-BR");
}

function formatLeaderboardName(value: string): string {
  const parts = value
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(toDisplayNameToken);

  if (parts.length === 0) {
    return "Aluno";
  }

  return parts.join(" ");
}

export default function GamificationPanel({
  snapshot,
  currentUserName,
  variant = "full",
}: GamificationPanelProps) {
  const compact = variant === "compact";
  const achievements = compact ? snapshot.achievements.slice(0, 6) : snapshot.achievements;
  const journey = getJourneyWindow(snapshot.weekJourney);
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
  const visibleRangeLabel =
    journey.length > 0
      ? `Semanas ${String(journey[0].weekNum).padStart(2, "0")} a ${String(
          journey[journey.length - 1].weekNum
        ).padStart(2, "0")}`
      : "Semanas 01 a 04";
  const activeWeekState = activeJourneyWeek
    ? getJourneyNodeState(activeJourneyWeek, activePhase)
    : {
        tone: "planned" as const,
        label: "Aguardando triagem",
        helper: "O protocolo inicial ainda vai ser iniciado.",
        footnote: "Proxima entrada clinica",
      };

  return (
    <section className={`${styles.panel} ${compact ? styles.compact : ""}`}>
      <div className={styles.hero}>
        <div>
          <p className={styles.kicker}>Gamificacao Ativa</p>
          <h2>Infografico clinico do aluno ate estabilizar o estudo</h2>
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
            ? `${snapshot.level.currentXp} pontos / ${snapshot.level.nextLevelXp} pontos`
            : `${snapshot.level.currentXp} pontos (Nivel Maximo)`}
        </small>
      </div>

      <div className={styles.metrics}>
        <article className={styles.metricCard}>
          <span>Pontuacao Total</span>
          <strong>{snapshot.totalXp}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Dias Seguidos</span>
          <strong>{snapshot.streak} dias</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Ritmo de Hoje</span>
          <strong>{snapshot.todayFocusCombo} cards</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Moedas</span>
          <strong>{snapshot.coins}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Posicao</span>
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
                  <strong>{getReadableMissionTitle(mission.id, mission.title)}</strong>
                  <span>
                    {mission.progress}/{mission.target}
                  </span>
                </div>
                <p>{getReadableMissionDescription(mission.id, mission.target, mission.description)}</p>
                <div className={styles.progressTrack}>
                  <span style={{ width: `${pct(mission.progress, mission.target)}%` }} />
                </div>
                <small>
                  +{mission.rewardXp} pontos | +{mission.rewardCoins} moedas
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
                title={getReadableAchievementDescription(achievement.id, achievement.description)}
              >
                <i className={`fas ${achievement.icon}`}></i>
                <strong>{getReadableAchievementTitle(achievement.id, achievement.title)}</strong>
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
                Classificacao Semanal
              </h3>
              <span>Alunos em destaque</span>
            </header>
            <ol className={styles.rankList}>
              {snapshot.leaderboard.map((entry) => (
                <li
                  key={`${entry.userId}-${entry.rank}`}
                  className={entry.isCurrentUser ? styles.me : ""}
                >
                  <span>#{entry.rank}</span>
                  <strong>
                    {formatLeaderboardName(
                      entry.isCurrentUser && currentUserName ? currentUserName : entry.displayName
                    )}
                  </strong>
                  <small>{entry.xp} pontos</small>
                </li>
              ))}
            </ol>
          </article>
        )}

        <article className={`${styles.block} ${styles.journeyBlock}`}>
          <header>
            <h3>
              <i className="fas fa-route"></i>
              Roadmap Clinico do Aluno
            </h3>
            <span>{visibleRangeLabel}</span>
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
                  ? `${activePhase.label}. ${activeJourneyWeek.completedCards} de ${activeJourneyWeek.totalCards} cards concluidos. ${activePhase.brief}`
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

          <div className={styles.journeyRoadmap}>
            <div className={styles.stethoscopeTop}>
              <span className={styles.scopeEarLeft}></span>
              <span className={styles.scopeEarRight}></span>
              <span className={styles.scopeTube}></span>
              <span className={styles.scopeChest}></span>
            </div>

            <div className={styles.timelineRail}></div>

            {journey.map((week, index) => {
              const phase = getJourneyPhase(week.weekNum);
              const journeyState = getJourneyNodeState(week, phase);
              const phaseStyle = getPhaseStyle(phase);
              const sideClass = index % 2 === 0 ? styles.stepRight : styles.stepLeft;

              return (
                <article
                  key={week.weekNum}
                  className={`${styles.roadmapStep} ${sideClass} ${getStopToneClass(journeyState.tone)}`}
                  style={phaseStyle}
                  title={`Semana ${week.weekNum} - ${week.percentage}%`}
                >
                  <div className={styles.stepConnector}></div>

                  <div className={styles.stepMarker}>
                    <div className={styles.stepMarkerCore}>
                      <i className={`fas ${phase.icon}`}></i>
                    </div>
                  </div>

                  <div className={styles.stepCard}>
                    <div className={styles.stepCardTop}>
                      <span className={styles.stepRoadmapLabel}>
                        Prontuario {String(week.weekNum).padStart(2, "0")}
                      </span>
                      <span className={styles.stepWard}>{phase.ward}</span>
                    </div>

                    <strong className={styles.stepHeadline}>{phase.label}</strong>
                    <p className={styles.stepBody}>{journeyState.helper}</p>

                    <div className={styles.stepMeta}>
                      <span>{week.totalCards > 0 ? `${week.completedCards}/${week.totalCards} cards` : "Sem cards"}</span>
                      <strong>{week.percentage}%</strong>
                    </div>

                    <small className={styles.stepFootnote}>{journeyState.footnote}</small>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}
