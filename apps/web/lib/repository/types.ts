export type RoomState =
  | "OPEN"
  | "MATCHED"
  | "RESOLVED"
  | "TIED"
  | "EXPIRED"
  | "CANCELLED";

export type Room = {
  id: string;
  state: RoomState;
  playerA: string;
  playerB: string | null;
  token: string;
  stake: string;
  winner: string | null;
  rollA1: number | null;
  rollA2: number | null;
  rollB1: number | null;
  rollB2: number | null;
  createdAt: string;
  resolvedAt: string | null;
  txCreate?: string;
  txResolve?: string | null;
};

export type Player = {
  id: string;
  totalGames: string;
  wins: string;
  losses: string;
  ties: string;
  totalVolume: string;
  totalWon: string;
  totalLost: string;
  lastGameAt: string;
  currentStreak: string;
  longestStreak: string;
};

export type LeaderboardEntry = {
  address: string;
  wins: number;
  losses: number;
  ties: number;
  totalGames: number;
  winRate: number;
  volume: bigint;
};

export type LiveStats = {
  openRooms: number;
  gamesToday: number;
  totalGames: number;
  myActiveRooms?: number;
};

export type PlayerMiniStats = {
  wins: number;
  losses: number;
  ties: number;
  currentStreak: number;
};

export type H2HSummary = {
  myWins: number;
  theirWins: number;
  ties: number;
};

export type RecentGame = {
  id: string;
  state: RoomState;
  winner: string | null;
  playerA: string;
  playerB: string | null;
  stake: string;
  token: string;
  resolvedAt: string | null;
};

export type ContractStats = {
  open: number;
  matched: number;
  resolved: number;
  tied: number;
  expired: number;
  totalFinished: number;
  volumeByToken: Record<string, bigint>;
  recentGames: RecentGame[];
};

export type SortKey = "wins" | "winRate" | "volume";
export type LeaderboardTab = "today" | "week" | "alltime";
