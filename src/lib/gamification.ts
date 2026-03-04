import { prisma } from "@/lib/prisma";
import {
  computeWeeklyBossTarget,
  getGamificationBalanceConfig,
  type GamificationBalanceConfig,
} from "@/lib/gamification-balance";
import { TOTAL_WEEKS, XP_CONFIG } from "@/types/content";
import type {
  GamificationAchievement,
  GamificationLeaderboardEntry,
  GamificationLevel,
  GamificationMission,
  GamificationSnapshot,
  GamificationWeekJourneyNode,
  GamificationWeeklyBoss,
} from "@/types/gamification";

export interface GamificationProgressRow {
  weekNum: number;
  cardId: string;
  isCompleted: boolean;
  xpEarned: number;
  updatedAt: Date;
}

export interface GamificationWeekCardRow {
  weekNum: number;
  cardId: string;
}

interface GamificationSnapshotInput {
  userId: string;
  currentWeek?: number;
  progressRows?: GamificationProgressRow[];
  weekCards?: GamificationWeekCardRow[];
}

interface XpByUser {
  userId: string;
  xp: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dateKeyUTC(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function atUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

function addDaysUTC(base: Date, deltaDays: number): Date {
  return atUtcDate(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + deltaDays
  );
}

function computeStreak(activityDayKeys: Set<string>): {
  streak: number;
  longestStreak: number;
} {
  if (activityDayKeys.size === 0) {
    return { streak: 0, longestStreak: 0 };
  }

  const sortedDays = Array.from(activityDayKeys).sort();
  let longest = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const previous = new Date(`${sortedDays[i - 1]}T00:00:00.000Z`);
    const current = new Date(`${sortedDays[i]}T00:00:00.000Z`);
    const diff = (current.getTime() - previous.getTime()) / 86_400_000;

    if (diff === 1) {
      currentRun += 1;
      if (currentRun > longest) {
        longest = currentRun;
      }
    } else {
      currentRun = 1;
    }
  }

  const today = atUtcDate(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  );
  let streak = 0;
  for (let offset = 0; offset < 400; offset++) {
    const key = dateKeyUTC(addDaysUTC(today, -offset));
    if (!activityDayKeys.has(key)) {
      break;
    }
    streak += 1;
  }

  return { streak, longestStreak: longest };
}

function computeLevel(totalXp: number): GamificationLevel {
  const levels = XP_CONFIG.LEVELS;
  const sorted = [...levels].sort((a, b) => a.xpRequired - b.xpRequired);
  let current = sorted[0];
  let next = null as (typeof sorted)[number] | null;

  for (const level of sorted) {
    if (totalXp >= level.xpRequired) {
      current = level;
      continue;
    }
    next = level;
    break;
  }

  if (!next) {
    return {
      level: current.level,
      title: current.title,
      currentXp: totalXp,
      nextLevelXp: null,
      xpIntoLevel: totalXp - current.xpRequired,
      xpForNextLevel: 0,
      progressPct: 100,
    };
  }

  const span = Math.max(1, next.xpRequired - current.xpRequired);
  const into = clamp(totalXp - current.xpRequired, 0, span);

  return {
    level: current.level,
    title: current.title,
    currentXp: totalXp,
    nextLevelXp: next.xpRequired,
    xpIntoLevel: into,
    xpForNextLevel: span,
    progressPct: Math.round((into / span) * 100),
  };
}

function buildWeekJourney(
  weekCards: GamificationWeekCardRow[],
  progressRows: GamificationProgressRow[],
  currentWeek: number
): GamificationWeekJourneyNode[] {
  const totalByWeek = new Map<number, Set<string>>();
  const completedByWeek = new Map<number, Set<string>>();

  for (const row of weekCards) {
    if (!totalByWeek.has(row.weekNum)) {
      totalByWeek.set(row.weekNum, new Set<string>());
    }
    totalByWeek.get(row.weekNum)?.add(row.cardId);
  }

  for (const row of progressRows) {
    if (!row.isCompleted) continue;
    if (!completedByWeek.has(row.weekNum)) {
      completedByWeek.set(row.weekNum, new Set<string>());
    }
    completedByWeek.get(row.weekNum)?.add(row.cardId);
  }

  const journey: GamificationWeekJourneyNode[] = [];
  for (let weekNum = 1; weekNum <= TOTAL_WEEKS; weekNum++) {
    const total = totalByWeek.get(weekNum)?.size || 0;
    const completed = completedByWeek.get(weekNum)?.size || 0;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    journey.push({
      weekNum,
      totalCards: total,
      completedCards: completed,
      percentage: pct,
      isCurrent: weekNum === currentWeek,
    });
  }

  return journey;
}

function normalizeCurrentWeek(
  currentWeek: number | undefined,
  journey: GamificationWeekJourneyNode[]
): number {
  if (currentWeek && currentWeek >= 1 && currentWeek <= TOTAL_WEEKS) {
    return currentWeek;
  }

  const firstIncomplete = journey.find((week) => week.percentage < 100 && week.totalCards > 0);
  if (firstIncomplete) {
    return firstIncomplete.weekNum;
  }

  const firstWithContent = journey.find((week) => week.totalCards > 0);
  return firstWithContent?.weekNum || 1;
}

function buildDailyMissions(
  input: {
    todayCardsCompleted: number;
    todayCardsTouched: number;
    xpToday: number;
  },
  balance: GamificationBalanceConfig
): GamificationMission[] {
  const missions: GamificationMission[] = [
    {
      id: "daily-cards",
      title: "Sprint de Cards",
      description: `Concluir ${balance.dailyCardTarget} card(s) hoje`,
      target: balance.dailyCardTarget,
      progress: input.todayCardsCompleted,
      completed: input.todayCardsCompleted >= balance.dailyCardTarget,
      rewardXp: balance.missionRewards.dailyCards.rewardXp,
      rewardCoins: balance.missionRewards.dailyCards.rewardCoins,
    },
    {
      id: "daily-touch",
      title: "Ritmo de Estudo",
      description: `Registrar progresso em ${balance.dailyTouchTarget} card(s) no dia`,
      target: balance.dailyTouchTarget,
      progress: input.todayCardsTouched,
      completed: input.todayCardsTouched >= balance.dailyTouchTarget,
      rewardXp: balance.missionRewards.dailyTouch.rewardXp,
      rewardCoins: balance.missionRewards.dailyTouch.rewardCoins,
    },
    {
      id: "daily-xp",
      title: "Meta de XP",
      description: `Somar ${balance.dailyXpTarget} XP hoje`,
      target: balance.dailyXpTarget,
      progress: input.xpToday,
      completed: input.xpToday >= balance.dailyXpTarget,
      rewardXp: balance.missionRewards.dailyXp.rewardXp,
      rewardCoins: balance.missionRewards.dailyXp.rewardCoins,
    },
  ];

  return missions.map((mission) => ({
    ...mission,
    progress: clamp(mission.progress, 0, mission.target),
  }));
}

function buildAchievements(
  input: {
    totalXp: number;
    completedCards: number;
    streak: number;
    longestStreak: number;
    completedWeeks: number;
    startedWeeks: number;
    todayFocusCombo: number;
    todayCardsCompleted: number;
  },
  balance: GamificationBalanceConfig
): GamificationAchievement[] {
  return [
    {
      id: "first-blood",
      title: "Primeiro Passo",
      description: "Concluiu o primeiro card.",
      icon: "fa-seedling",
      unlocked: input.completedCards >= 1,
    },
    {
      id: "combo-runner",
      title: `Combo ${balance.achievementTargets.comboRun}x`,
      description: `Fez combo de foco em ${balance.achievementTargets.comboRun} cards no dia.`,
      icon: "fa-bolt",
      unlocked: input.todayFocusCombo >= balance.achievementTargets.comboRun,
    },
    {
      id: "streak-3",
      title: "Constância 3 Dias",
      description: "Manteve 3 dias seguidos de estudo.",
      icon: "fa-fire",
      unlocked: input.streak >= 3 || input.longestStreak >= 3,
    },
    {
      id: "streak-7",
      title: "Streak de 7 Dias",
      description: "Manteve 7 dias seguidos de estudo.",
      icon: "fa-fire-flame-curved",
      unlocked: input.streak >= 7 || input.longestStreak >= 7,
    },
    {
      id: "week-master",
      title: "Mestre Semanal",
      description: "Finalizou 1 semana completa.",
      icon: "fa-crown",
      unlocked: input.completedWeeks >= 1,
    },
    {
      id: "half-journey",
      title: "Meio do Caminho",
      description: `Iniciou ao menos ${balance.achievementTargets.halfJourneyWeeks} semanas.`,
      icon: "fa-route",
      unlocked: input.startedWeeks >= balance.achievementTargets.halfJourneyWeeks,
    },
    {
      id: "centurion",
      title: "Centurião",
      description: `Concluiu ${balance.achievementTargets.centurionCards} cards.`,
      icon: "fa-medal",
      unlocked: input.completedCards >= balance.achievementTargets.centurionCards,
    },
    {
      id: "marathon",
      title: "Dia Perfeito",
      description: `Concluiu ${balance.achievementTargets.dailyMarathonCards} cards em um dia.`,
      icon: "fa-star",
      unlocked: input.todayCardsCompleted >= balance.achievementTargets.dailyMarathonCards,
    },
    {
      id: "xp-legend",
      title: "Lenda XP",
      description: `Ultrapassou ${balance.achievementTargets.legendXp.toLocaleString("pt-BR")} XP.`,
      icon: "fa-gem",
      unlocked: input.totalXp >= balance.achievementTargets.legendXp,
    },
  ];
}

function buildWeeklyBoss(input: {
  currentWeek: number;
  weekJourney: GamificationWeekJourneyNode[];
  balance: GamificationBalanceConfig;
}): GamificationWeeklyBoss {
  const node = input.weekJourney.find((week) => week.weekNum === input.currentWeek);
  const total = node?.totalCards || 0;
  const target = computeWeeklyBossTarget(total);
  const progress = clamp(node?.completedCards || 0, 0, target);

  return {
    weekNum: input.currentWeek,
    title: `Boss da Semana ${input.currentWeek}`,
    target,
    progress,
    completed: total > 0 && progress >= target,
    rewardXp: input.balance.weeklyBossRewardXp,
    rewardCoins: input.balance.weeklyBossRewardCoins,
  };
}

function resolveDisplayName(input: {
  name: string | null;
  email: string | null;
  isCurrentUser: boolean;
}): string {
  if (input.isCurrentUser) {
    return "Você";
  }

  if (input.name && input.name.trim().length > 0) {
    return input.name.trim();
  }

  if (input.email && input.email.includes("@")) {
    return input.email.split("@")[0];
  }

  return "Aluno";
}

async function buildLeaderboard(input: {
  userId: string;
  totalXp: number;
}): Promise<{ leaderboard: GamificationLeaderboardEntry[]; userRank: number | null }> {
  const grouped = await prisma.userProgress.groupBy({
    by: ["userId"],
    _sum: { xpEarned: true },
  });

  const xpByUser: XpByUser[] = grouped.map((row) => ({
    userId: row.userId,
    xp: Math.max(0, row._sum.xpEarned || 0),
  }));

  if (!xpByUser.some((row) => row.userId === input.userId)) {
    xpByUser.push({ userId: input.userId, xp: Math.max(0, input.totalXp) });
  }

  xpByUser.sort((a, b) => b.xp - a.xp || a.userId.localeCompare(b.userId));

  const rankMap = new Map<string, number>();
  xpByUser.forEach((row, index) => {
    rankMap.set(row.userId, index + 1);
  });

  const userRank = rankMap.get(input.userId) || null;
  const top = xpByUser.slice(0, 8);
  if (userRank && userRank > 8) {
    const me = xpByUser.find((row) => row.userId === input.userId);
    if (me) {
      top.push(me);
    }
  }

  const ids = Array.from(new Set(top.map((row) => row.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((user) => [user.id, user]));

  const leaderboard: GamificationLeaderboardEntry[] = top
    .map((row) => {
      const user = userMap.get(row.userId);
      const isCurrentUser = row.userId === input.userId;
      return {
        rank: rankMap.get(row.userId) || 0,
        userId: row.userId,
        displayName: resolveDisplayName({
          name: user?.name || null,
          email: user?.email || null,
          isCurrentUser,
        }),
        xp: row.xp,
        isCurrentUser,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  return { leaderboard, userRank };
}

export async function getGamificationSnapshot(
  input: GamificationSnapshotInput
): Promise<GamificationSnapshot> {
  const balance = getGamificationBalanceConfig();

  const [progressRows, weekCards] = await Promise.all([
    input.progressRows
      ? Promise.resolve(input.progressRows)
      : prisma.userProgress.findMany({
          where: { userId: input.userId },
          select: {
            weekNum: true,
            cardId: true,
            isCompleted: true,
            xpEarned: true,
            updatedAt: true,
          },
        }),
    input.weekCards
      ? Promise.resolve(input.weekCards)
      : prisma.weekContent.findMany({
          select: { weekNum: true, cardId: true },
        }),
  ]);

  const provisionalJourney = buildWeekJourney(weekCards, progressRows, 1);
  const currentWeek = normalizeCurrentWeek(input.currentWeek, provisionalJourney);
  const weekJourney = buildWeekJourney(weekCards, progressRows, currentWeek);

  const totalXp = progressRows.reduce(
    (sum, row) => sum + Math.max(0, row.xpEarned || 0),
    0
  );
  const completedCards = progressRows.filter((row) => row.isCompleted).length;
  const totalCards = weekJourney.reduce((sum, week) => sum + week.totalCards, 0);
  const completedWeeks = weekJourney.filter(
    (week) => week.totalCards > 0 && week.percentage >= 100
  ).length;
  const startedWeeks = weekJourney.filter((week) => week.completedCards > 0).length;

  const todayKey = dateKeyUTC(new Date());
  const touchedToday = new Set<string>();
  const completedToday = new Set<string>();
  let xpToday = 0;
  const activityDays = new Set<string>();

  for (const row of progressRows) {
    const rowDate = dateKeyUTC(row.updatedAt);
    activityDays.add(rowDate);
    if (rowDate !== todayKey) continue;

    const uniq = `${row.weekNum}-${row.cardId}`;
    touchedToday.add(uniq);
    if (row.isCompleted) {
      completedToday.add(uniq);
    }
    xpToday += Math.max(0, row.xpEarned || 0);
  }

  const todayCardsTouched = touchedToday.size;
  const todayCardsCompleted = completedToday.size;
  const todayFocusCombo = Math.min(balance.comboCap, todayCardsTouched);

  const { streak, longestStreak } = computeStreak(activityDays);
  const dailyMissions = buildDailyMissions(
    {
      todayCardsCompleted,
      todayCardsTouched,
      xpToday,
    },
    balance
  );
  const achievements = buildAchievements(
    {
      totalXp,
      completedCards,
      streak,
      longestStreak,
      completedWeeks,
      startedWeeks,
      todayFocusCombo,
      todayCardsCompleted,
    },
    balance
  );
  const weeklyBoss = buildWeeklyBoss({ currentWeek, weekJourney, balance });
  const level = computeLevel(totalXp);

  const completedMissions = dailyMissions.filter((mission) => mission.completed).length;
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked).length;
  const coins =
    Math.floor(totalXp / balance.coinEconomy.xpPerCoin) +
    completedMissions * balance.coinEconomy.missionBonus +
    unlockedAchievements * balance.coinEconomy.achievementBonus +
    completedWeeks * balance.coinEconomy.completedWeekBonus +
    streak * balance.coinEconomy.streakDailyBonus;

  const chestProgressPct = clamp(
    Math.round((Math.min(streak, balance.chestStreakTarget) / balance.chestStreakTarget) * 100),
    0,
    100
  );

  const { leaderboard, userRank } = await buildLeaderboard({
    userId: input.userId,
    totalXp,
  });

  return {
    balanceProfile: balance.id,
    balanceLabel: balance.label,
    totalXp,
    coins,
    level,
    streak,
    longestStreak,
    todayCardsCompleted,
    todayCardsTouched,
    todayFocusCombo,
    completedCards,
    totalCards,
    completedWeeks,
    startedWeeks,
    currentWeek,
    userRank,
    dailyMissions,
    weeklyBoss,
    achievements,
    leaderboard,
    weekJourney,
    surpriseChest: {
      requiredStreak: balance.chestStreakTarget,
      currentStreak: streak,
      ready: streak >= balance.chestStreakTarget,
      progressPct: chestProgressPct,
      rewardLabel: `+${balance.chestReward.xp} XP +${balance.chestReward.coins} moedas`,
    },
  };
}
