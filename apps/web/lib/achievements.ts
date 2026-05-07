import { getTokenDecimals } from "@/lib/constants";
import type { IndexerPlayer, IndexerProfileRoom } from "@/lib/indexer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Rarity = "common" | "rare" | "epic" | "legendary";

export type PlayerStats = {
  wins: number;
  losses: number;
  ties: number;
  totalGames: number;
  longestStreak: number;
  currentStreak: number;
  /** Highest hand sum rolled in any game (max 12). */
  maxRoll: number;
  /** Lowest hand sum rolled in any game (min 2). */
  minRoll: number;
  /** Highest single stake in human-readable USD equivalent. */
  maxStakeUSD: number;
  /** True if player won a game after 3+ consecutive losses (from available history). */
  comebackWin: boolean;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  rarity: Rarity;
  check: (p: PlayerStats) => boolean;
  /** For quantifiable achievements: show a progress bar. */
  progress?: (p: PlayerStats) => { value: number; max: number };
};

// ─── Achievements ─────────────────────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [
  // ── Wins ──────────────────────────────────────────────────────────────────
  {
    id: "first-win",
    name: "First Win",
    description: "Win your first game",
    emoji: "🎯",
    rarity: "common",
    check: (p) => p.wins >= 1,
    progress: (p) => ({ value: Math.min(p.wins, 1), max: 1 }),
  },
  {
    id: "5-wins",
    name: "Streak Starter",
    description: "Win 5 games",
    emoji: "⚡",
    rarity: "common",
    check: (p) => p.wins >= 5,
    progress: (p) => ({ value: Math.min(p.wins, 5), max: 5 }),
  },
  {
    id: "25-wins",
    name: "Roller",
    description: "Win 25 games",
    emoji: "💪",
    rarity: "rare",
    check: (p) => p.wins >= 25,
    progress: (p) => ({ value: Math.min(p.wins, 25), max: 25 }),
  },
  {
    id: "100-wins",
    name: "Legend",
    description: "Win 100 games",
    emoji: "👑",
    rarity: "legendary",
    check: (p) => p.wins >= 100,
    progress: (p) => ({ value: Math.min(p.wins, 100), max: 100 }),
  },

  // ── Dice ──────────────────────────────────────────────────────────────────
  {
    id: "lucky-12",
    name: "Lucky 12",
    description: "Roll a perfect 12 (both dice land on 6)",
    emoji: "🎲",
    rarity: "rare",
    check: (p) => p.maxRoll >= 12,
  },
  {
    id: "snake-eyes",
    name: "Snake Eyes",
    description: "Roll a 2 (both dice land on 1)",
    emoji: "🐍",
    rarity: "rare",
    check: (p) => p.minRoll <= 2,
  },

  // ── Streaks ───────────────────────────────────────────────────────────────
  {
    id: "hat-trick",
    name: "Hat Trick",
    description: "Win 3 games in a row",
    emoji: "🎩",
    rarity: "common",
    check: (p) => p.longestStreak >= 3,
    progress: (p) => ({ value: Math.min(p.longestStreak, 3), max: 3 }),
  },
  {
    id: "hot-streak",
    name: "Hot Streak",
    description: "Win 5 games in a row",
    emoji: "🔥",
    rarity: "rare",
    check: (p) => p.longestStreak >= 5,
    progress: (p) => ({ value: Math.min(p.longestStreak, 5), max: 5 }),
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    description: "Win 10 games in a row",
    emoji: "🌪️",
    rarity: "legendary",
    check: (p) => p.longestStreak >= 10,
    progress: (p) => ({ value: Math.min(p.longestStreak, 10), max: 10 }),
  },

  // ── Special ───────────────────────────────────────────────────────────────
  {
    id: "comeback",
    name: "Comeback Kid",
    description: "Win a game after 3 consecutive losses",
    emoji: "💫",
    rarity: "epic",
    check: (p) => p.comebackWin,
  },
  {
    id: "whale",
    name: "Whale",
    description: "Place a single bet over $5",
    emoji: "🐋",
    rarity: "epic",
    check: (p) => p.maxStakeUSD >= 5,
  },
  {
    id: "veteran",
    name: "Veteran",
    description: "Play 50 games",
    emoji: "🏅",
    rarity: "rare",
    check: (p) => p.totalGames >= 50,
    progress: (p) => ({ value: Math.min(p.totalGames, 50), max: 50 }),
  },
  {
    id: "pacifist",
    name: "Pacifist",
    description: "Tie 5 games",
    emoji: "🤝",
    rarity: "common",
    check: (p) => p.ties >= 5,
    progress: (p) => ({ value: Math.min(p.ties, 5), max: 5 }),
  },
];

// ─── Rarity sort order ────────────────────────────────────────────────────────

const RARITY_ORDER: Record<Rarity, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
};

/** Returns achievements sorted: unlocked first, then by rarity descending. */
export function sortedAchievements(stats: PlayerStats): {
  achievement: Achievement;
  unlocked: boolean;
}[] {
  return ACHIEVEMENTS.map((a) => ({ achievement: a, unlocked: a.check(stats) })).sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return RARITY_ORDER[a.achievement.rarity] - RARITY_ORDER[b.achievement.rarity];
  });
}

// ─── Stats builder ────────────────────────────────────────────────────────────

export function buildPlayerStats(
  player: IndexerPlayer,
  rooms: IndexerProfileRoom[],
  address: string
): PlayerStats {
  const addrLower = address.toLowerCase();

  let maxRoll = 0;
  let minRoll = Infinity;
  let maxStakeUSD = 0;

  for (const room of rooms) {
    // Normalize stake to USD equivalent regardless of token decimals
    const decimals = getTokenDecimals(room.token as `0x${string}`);
    const stakeUSD = Number(room.stake) / 10 ** decimals;
    if (stakeUSD > maxStakeUSD) maxStakeUSD = stakeUSD;

    if (room.rollA1 == null || room.rollB1 == null) continue;
    const isA = room.playerA.toLowerCase() === addrLower;
    const d1 = isA ? room.rollA1 : room.rollB1;
    const d2 = isA ? (room.rollA2 ?? 0) : (room.rollB2 ?? 0);
    const sum = d1 + d2;
    if (sum > maxRoll) maxRoll = sum;
    if (sum < minRoll) minRoll = sum;
  }

  // Detect comeback win: win that followed 3+ consecutive losses in available history
  const sorted = [...rooms].sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
  let consecutiveLosses = 0;
  let comebackWin = false;
  for (const room of sorted) {
    const winner = room.winner?.toLowerCase();
    if (room.state === "RESOLVED") {
      if (winner === addrLower) {
        if (consecutiveLosses >= 3) comebackWin = true;
        consecutiveLosses = 0;
      } else {
        consecutiveLosses++;
      }
    }
    // ties and expired don't reset or increment consecutive losses
  }

  return {
    wins: Number(player.wins),
    losses: Number(player.losses),
    ties: Number(player.ties),
    totalGames: Number(player.totalGames),
    longestStreak: Number(player.longestStreak),
    currentStreak: Number(player.currentStreak),
    maxRoll: maxRoll === 0 ? 0 : maxRoll,
    minRoll: minRoll === Infinity ? 12 : minRoll,
    maxStakeUSD,
    comebackWin,
  };
}
