import type { GamificationBalanceProfile } from "@/types/gamification";

export interface MissionRewardConfig {
  rewardXp: number;
  rewardCoins: number;
}

export interface GamificationBalanceConfig {
  id: GamificationBalanceProfile;
  label: string;
  xpPerMilestone100: number;
  xpCardCompletion: number;
  xpPerfectCardBonus: number;
  dailyCardTarget: number;
  dailyTouchTarget: number;
  dailyXpTarget: number;
  comboCap: number;
  chestStreakTarget: number;
  weeklyBossTargetRatio: number;
  weeklyBossRewardXp: number;
  weeklyBossRewardCoins: number;
  missionRewards: {
    dailyCards: MissionRewardConfig;
    dailyTouch: MissionRewardConfig;
    dailyXp: MissionRewardConfig;
  };
  coinEconomy: {
    xpPerCoin: number;
    missionBonus: number;
    achievementBonus: number;
    completedWeekBonus: number;
    streakDailyBonus: number;
  };
  chestReward: {
    xp: number;
    coins: number;
  };
  achievementTargets: {
    comboRun: number;
    dailyMarathonCards: number;
    centurionCards: number;
    halfJourneyWeeks: number;
    legendXp: number;
  };
}

const BALANCE_PROFILES: Record<GamificationBalanceProfile, GamificationBalanceConfig> = {
  leve: {
    id: "leve",
    label: "Leve",
    xpPerMilestone100: 4,
    xpCardCompletion: 14,
    xpPerfectCardBonus: 5,
    dailyCardTarget: 1,
    dailyTouchTarget: 3,
    dailyXpTarget: 24,
    comboCap: 5,
    chestStreakTarget: 3,
    weeklyBossTargetRatio: 0.75,
    weeklyBossRewardXp: 36,
    weeklyBossRewardCoins: 20,
    missionRewards: {
      dailyCards: { rewardXp: 14, rewardCoins: 8 },
      dailyTouch: { rewardXp: 12, rewardCoins: 7 },
      dailyXp: { rewardXp: 12, rewardCoins: 7 },
    },
    coinEconomy: {
      xpPerCoin: 28,
      missionBonus: 6,
      achievementBonus: 4,
      completedWeekBonus: 4,
      streakDailyBonus: 1,
    },
    chestReward: { xp: 24, coins: 15 },
    achievementTargets: {
      comboRun: 2,
      dailyMarathonCards: 4,
      centurionCards: 80,
      halfJourneyWeeks: 10,
      legendXp: 1800,
    },
  },
  padrao: {
    id: "padrao",
    label: "Padrao",
    xpPerMilestone100: 5,
    xpCardCompletion: 20,
    xpPerfectCardBonus: 8,
    dailyCardTarget: 2,
    dailyTouchTarget: 4,
    dailyXpTarget: 40,
    comboCap: 7,
    chestStreakTarget: 5,
    weeklyBossTargetRatio: 0.9,
    weeklyBossRewardXp: 60,
    weeklyBossRewardCoins: 35,
    missionRewards: {
      dailyCards: { rewardXp: 24, rewardCoins: 14 },
      dailyTouch: { rewardXp: 18, rewardCoins: 10 },
      dailyXp: { rewardXp: 20, rewardCoins: 12 },
    },
    coinEconomy: {
      xpPerCoin: 24,
      missionBonus: 8,
      achievementBonus: 6,
      completedWeekBonus: 5,
      streakDailyBonus: 1,
    },
    chestReward: { xp: 40, coins: 25 },
    achievementTargets: {
      comboRun: 3,
      dailyMarathonCards: 5,
      centurionCards: 100,
      halfJourneyWeeks: 12,
      legendXp: 2500,
    },
  },
  hardcore: {
    id: "hardcore",
    label: "Hardcore",
    xpPerMilestone100: 6,
    xpCardCompletion: 24,
    xpPerfectCardBonus: 10,
    dailyCardTarget: 3,
    dailyTouchTarget: 6,
    dailyXpTarget: 70,
    comboCap: 10,
    chestStreakTarget: 7,
    weeklyBossTargetRatio: 1,
    weeklyBossRewardXp: 90,
    weeklyBossRewardCoins: 50,
    missionRewards: {
      dailyCards: { rewardXp: 34, rewardCoins: 18 },
      dailyTouch: { rewardXp: 28, rewardCoins: 14 },
      dailyXp: { rewardXp: 30, rewardCoins: 16 },
    },
    coinEconomy: {
      xpPerCoin: 20,
      missionBonus: 10,
      achievementBonus: 8,
      completedWeekBonus: 7,
      streakDailyBonus: 2,
    },
    chestReward: { xp: 60, coins: 34 },
    achievementTargets: {
      comboRun: 4,
      dailyMarathonCards: 6,
      centurionCards: 130,
      halfJourneyWeeks: 14,
      legendXp: 3400,
    },
  },
};

function normalizeProfile(input: string | undefined): GamificationBalanceProfile {
  const raw = (input || "").trim().toLowerCase();
  if (raw === "leve" || raw === "easy") {
    return "leve";
  }
  if (raw === "hardcore" || raw === "hard" || raw === "dificil" || raw === "difícil") {
    return "hardcore";
  }
  if (raw === "padrao" || raw === "padrão" || raw === "standard" || raw === "default") {
    return "padrao";
  }
  return "padrao";
}

export function getGamificationBalanceConfig(): GamificationBalanceConfig {
  const selected = normalizeProfile(process.env.GAMIFICATION_PROFILE);
  return BALANCE_PROFILES[selected];
}

export function getGamificationProfileId(): GamificationBalanceProfile {
  return getGamificationBalanceConfig().id;
}

export function calculateCardXp(input: {
  progressData: Record<string, number>;
  isCompleted: boolean;
  isPerfect: boolean;
}): number {
  const balance = getGamificationBalanceConfig();
  const completedMilestones = Object.values(input.progressData).filter(
    (value) => value >= 100
  ).length;
  const totalXp =
    completedMilestones * balance.xpPerMilestone100 +
    (input.isCompleted ? balance.xpCardCompletion : 0) +
    (input.isPerfect ? balance.xpPerfectCardBonus : 0);
  return Math.max(0, Math.round(totalXp));
}

export function computeWeeklyBossTarget(totalCards: number): number {
  const balance = getGamificationBalanceConfig();
  if (totalCards <= 0) return 1;
  return Math.max(1, Math.ceil(totalCards * balance.weeklyBossTargetRatio));
}
