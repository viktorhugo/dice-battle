import { GraphQLClient, gql } from "graphql-request";

const ENDPOINT =
  process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:8080/v1/graphql";

export const indexer = new GraphQLClient(ENDPOINT);

// ─── Types ────────────────────────────────────────────────────────────────────

export type IndexerRoom = {
  id: string;
  playerA: string;
  token: string;
  stake: string;
  createdAt: string;
};

export type IndexerPlayer = {
  totalGames: string;
  wins: string;
  losses: string;
  ties: string;
  totalVolume: string;
  currentStreak: string;
  longestStreak: string;
};

export type IndexerLeaderboardPlayer = {
  id: string;
  totalGames: string;
  wins: string;
  losses: string;
  ties: string;
  totalVolume: string;
};

export type IndexerPeriodRoom = {
  winner: string | null;
  playerA: string;
  playerB: string | null;
  state: string;
  stake: string;
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

export type SortKey = "wins" | "winRate" | "volume";

export type LeaderboardTab = "today" | "week" | "alltime";

export type IndexerProfileRoom = {
  id: string;
  state: string;
  playerA: string;
  playerB: string | null;
  winner: string | null;
  stake: string;
  token: string;
  rollA1: number | null;
  rollA2: number | null;
  rollB1: number | null;
  rollB2: number | null;
  createdAt: string;
  resolvedAt: string | null;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

const OPEN_ROOMS_QUERY = gql`
  query OpenRooms($limit: Int!) {
    Room(
      limit: $limit
      order_by: { createdAt: desc }
      where: { state: { _eq: "OPEN" } }
    ) {
      id
      playerA
      token
      stake
      createdAt
    }
  }
`;

const PLAYER_PROFILE_QUERY = gql`
  query PlayerProfile($id: String!) {
    Player_by_pk(id: $id) {
      totalGames
      wins
      losses
      ties
      totalVolume
      currentStreak
      longestStreak
    }
    Room(
      where: {
        _and: [
          { _or: [{ playerA: { _eq: $id } }, { playerB: { _eq: $id } }] }
          { state: { _in: ["RESOLVED", "TIED", "EXPIRED"] } }
        ]
      }
      order_by: { resolvedAt: desc }
      limit: 10
    ) {
      id
      state
      playerA
      playerB
      winner
      stake
      token
      rollA1
      rollA2
      rollB1
      rollB2
      createdAt
      resolvedAt
    }
  }
`;

const LEADERBOARD_QUERY = gql`
  query Leaderboard($limit: Int!) {
    Player(limit: $limit, order_by: { wins: desc }) {
      id
      totalGames
      wins
      losses
      ties
      totalVolume
    }
  }
`;

const LEADERBOARD_PERIOD_QUERY = gql`
  query LeaderboardPeriod($since: numeric!) {
    Room(
      where: {
        _and: [
          { resolvedAt: { _gte: $since } }
          { state: { _in: ["RESOLVED", "TIED"] } }
        ]
      }
      limit: 500
    ) {
      winner
      playerA
      playerB
      state
      stake
    }
  }
`;

// ─── Functions ────────────────────────────────────────────────────────────────

export async function getOpenRooms(limit = 20): Promise<IndexerRoom[]> {
  const data = await indexer.request<{ Room: IndexerRoom[] }>(
    OPEN_ROOMS_QUERY,
    { limit }
  );
  return data.Room;
}

export async function getPlayerProfile(address: string): Promise<{
  player: IndexerPlayer | null;
  rooms: IndexerProfileRoom[];
}> {
  const id = address.toLowerCase();
  const data = await indexer.request<{
    Player_by_pk: IndexerPlayer | null;
    Room: IndexerProfileRoom[];
  }>(PLAYER_PROFILE_QUERY, { id });
  return { player: data.Player_by_pk, rooms: data.Room };
}

export async function getLeaderboardAllTime(limit = 50): Promise<LeaderboardEntry[]> {
  const data = await indexer.request<{ Player: IndexerLeaderboardPlayer[] }>(
    LEADERBOARD_QUERY,
    { limit }
  );
  return data.Player.map((p) => {
    const totalGames = Number(p.totalGames);
    return {
      address: p.id,
      wins: Number(p.wins),
      losses: Number(p.losses),
      ties: Number(p.ties),
      totalGames,
      winRate: totalGames > 0 ? Math.round((Number(p.wins) / totalGames) * 100) : 0,
      volume: BigInt(p.totalVolume),
    };
  });
}

export async function getLeaderboardPeriod(sinceSeconds: number): Promise<LeaderboardEntry[]> {
  const data = await indexer.request<{ Room: IndexerPeriodRoom[] }>(
    LEADERBOARD_PERIOD_QUERY,
    { since: sinceSeconds.toString() }
  );

  const map = new Map<string, { wins: number; losses: number; ties: number; volume: bigint }>();

  for (const room of data.Room) {
    const participants = [room.playerA, room.playerB].filter(Boolean) as string[];
    for (const addr of participants) {
      if (!map.has(addr)) map.set(addr, { wins: 0, losses: 0, ties: 0, volume: 0n });
      const p = map.get(addr)!;
      p.volume += BigInt(room.stake);
      if (room.state === "TIED") {
        p.ties++;
      } else if (room.winner === addr) {
        p.wins++;
      } else {
        p.losses++;
      }
    }
  }

  return Array.from(map.entries()).map(([address, s]) => {
    const totalGames = s.wins + s.losses + s.ties;
    return {
      address,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      totalGames,
      winRate: totalGames > 0 ? Math.round((s.wins / totalGames) * 100) : 0,
      volume: s.volume,
    };
  });
}
