export type GamificationBalanceProfile = "leve" | "padrao" | "hardcore";

export interface GamificationLevel {
  level: number;
  title: string;
  currentXp: number;
  nextLevelXp: number | null;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPct: number;
}

export interface GamificationMission {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  rewardXp: number;
  rewardCoins: number;
}

export interface GamificationAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface GamificationLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  xp: number;
  isCurrentUser: boolean;
}

export interface GamificationWeekJourneyNode {
  weekNum: number;
  totalCards: number;
  completedCards: number;
  percentage: number;
  isCurrent: boolean;
}

export interface GamificationWeeklyBoss {
  weekNum: number;
  title: string;
  target: number;
  progress: number;
  completed: boolean;
  rewardXp: number;
  rewardCoins: number;
}

export interface GamificationSurpriseChest {
  requiredStreak: number;
  currentStreak: number;
  ready: boolean;
  progressPct: number;
  rewardLabel: string;
}

export interface GamificationSnapshot {
  balanceProfile: GamificationBalanceProfile;
  balanceLabel: string;
  totalXp: number;
  coins: number;
  level: GamificationLevel;
  streak: number;
  longestStreak: number;
  todayCardsCompleted: number;
  todayCardsTouched: number;
  todayFocusCombo: number;
  completedCards: number;
  totalCards: number;
  completedWeeks: number;
  startedWeeks: number;
  currentWeek: number;
  userRank: number | null;
  dailyMissions: GamificationMission[];
  weeklyBoss: GamificationWeeklyBoss;
  achievements: GamificationAchievement[];
  leaderboard: GamificationLeaderboardEntry[];
  weekJourney: GamificationWeekJourneyNode[];
  surpriseChest: GamificationSurpriseChest;
}
