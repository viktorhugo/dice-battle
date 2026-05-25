import { GraphQLClient, gql } from "graphql-request";

const ENDPOINT =
  process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:8080/v1/graphql";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_INDEXER_ADMIN_SECRET;

export const indexer = new GraphQLClient(ENDPOINT, {
  headers: ADMIN_SECRET ? { "x-hasura-admin-secret": ADMIN_SECRET } : {},
});

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

const OPEN_ROOMS_PAGE_QUERY = gql`
  query OpenRoomsPage($limit: Int!, $offset: Int!) {
    Room(
      limit: $limit
      offset: $offset
      order_by: { createdAt: desc }
      where: { state: { _eq: "OPEN" } }
    ) {
      id
      playerA
      token
      stake
      createdAt
    }
    allOpen: Room(where: { state: { _eq: "OPEN" } }, limit: 500) {
      id
    }
  }
`;

const OPEN_ROOMS_PAGE_FILTERED_QUERY = gql`
  query OpenRoomsPageFiltered($limit: Int!, $offset: Int!, $excludeAddress: String!) {
    Room(
      limit: $limit
      offset: $offset
      order_by: { createdAt: desc }
      where: {
        _and: [
          { state: { _eq: "OPEN" } }
          { playerA: { _neq: $excludeAddress } }
        ]
      }
    ) {
      id
      playerA
      token
      stake
      createdAt
    }
    allOpen: Room(
      where: {
        _and: [
          { state: { _eq: "OPEN" } }
          { playerA: { _neq: $excludeAddress } }
        ]
      }
      limit: 500
    ) {
      id
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

const LIVE_STATS_QUERY = gql`
  query LiveStats($since: numeric!) {
    openRooms: Room(where: { state: { _eq: "OPEN" } }, limit: 500) {
      id
    }
    gamesToday: Room(
      where: {
        _and: [
          { resolvedAt: { _gte: $since } }
          { state: { _in: ["RESOLVED", "TIED"] } }
        ]
      }
      limit: 500
    ) {
      id
    }
    totalGames: Room(
      where: { state: { _in: ["RESOLVED", "TIED"] } }
      limit: 9999
    ) {
      id
    }
  }
`;

const LIVE_STATS_FILTERED_QUERY = gql`
  query LiveStatsFiltered($since: numeric!, $excludeAddress: String!) {
    openRooms: Room(
      where: {
        _and: [
          { state: { _eq: "OPEN" } }
          { playerA: { _neq: $excludeAddress } }
        ]
      }
      limit: 500
    ) {
      id
    }
    gamesToday: Room(
      where: {
        _and: [
          { resolvedAt: { _gte: $since } }
          { state: { _in: ["RESOLVED", "TIED"] } }
        ]
      }
      limit: 500
    ) {
      id
    }
    totalGames: Room(
      where: { state: { _in: ["RESOLVED", "TIED"] } }
      limit: 9999
    ) {
      id
    }
    matchedForMe: Room(
      where: {
        _and: [
          { state: { _eq: "MATCHED" } }
          { playerA: { _eq: $excludeAddress } }
        ]
      }
      limit: 50
    ) {
      id
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

export async function getOpenRoomsPage(
  page: number,
  pageSize = 10,
  excludeAddress?: string
): Promise<{ rooms: IndexerRoom[]; total: number }> {
  const offset = (page - 1) * pageSize;

  if (excludeAddress) {
    const data = await indexer.request<{
      Room: IndexerRoom[];
      allOpen: { id: string }[];
    }>(OPEN_ROOMS_PAGE_FILTERED_QUERY, {
      limit: pageSize,
      offset,
      excludeAddress: excludeAddress.toLowerCase(),
    });
    return { rooms: data.Room, total: data.allOpen.length };
  }

  const data = await indexer.request<{
    Room: IndexerRoom[];
    allOpen: { id: string }[];
  }>(OPEN_ROOMS_PAGE_QUERY, { limit: pageSize, offset });
  return { rooms: data.Room, total: data.allOpen.length };
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

export type LiveStats = {
  openRooms: number;
  gamesToday: number;
  totalGames: number;
  matchedForMe?: number;
};

export async function getLiveStats(excludeAddress?: string): Promise<LiveStats> {
  const since = Math.floor(Date.now() / 1000) - 86_400;
  const query = excludeAddress ? LIVE_STATS_FILTERED_QUERY : LIVE_STATS_QUERY;
  const variables = excludeAddress
    ? { since: since.toString(), excludeAddress: excludeAddress.toLowerCase() }
    : { since: since.toString() };
  const data = await indexer.request<{
    openRooms: { id: string }[];
    gamesToday: { id: string }[];
    totalGames: { id: string }[];
    matchedForMe?: { id: string }[];
  }>(query, variables);
  return {
    openRooms: data.openRooms.length,
    gamesToday: data.gamesToday.length,
    totalGames: data.totalGames.length,
    ...(data.matchedForMe != null && { matchedForMe: data.matchedForMe.length }),
  };
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

const PLAYER_MINI_STATS_QUERY = gql`
  query PlayerMiniStats($id: String!) {
    Player_by_pk(id: $id) {
      wins
      losses
      ties
      currentStreak
    }
  }
`;

const ROOM_CREATED_AT_QUERY = gql`
  query RoomCreatedAt($id: String!) {
    Room(where: { id: { _eq: $id } }, limit: 1) {
      createdAt
    }
  }
`;

const HEAD_TO_HEAD_QUERY = gql`
  query HeadToHead($a: String!, $b: String!) {
    Room(
      where: {
        _and: [
          {
            _or: [
              { _and: [{ playerA: { _eq: $a } }, { playerB: { _eq: $b } }] }
              { _and: [{ playerA: { _eq: $b } }, { playerB: { _eq: $a } }] }
            ]
          }
          { state: { _in: ["RESOLVED", "TIED"] } }
        ]
      }
      order_by: { resolvedAt: desc }
      limit: 20
    ) {
      winner
      state
    }
  }
`;

export type PlayerMiniStats = {
  wins: number;
  losses: number;
  ties: number;
  currentStreak: number;
};

export async function getPlayerMiniStats(address: string): Promise<PlayerMiniStats | null> {
  const id = address.toLowerCase();
  const data = await indexer.request<{
    Player_by_pk: { wins: string; losses: string; ties: string; currentStreak: string } | null;
  }>(PLAYER_MINI_STATS_QUERY, { id });
  if (!data.Player_by_pk) return null;
  const p = data.Player_by_pk;
  return {
    wins: Number(p.wins),
    losses: Number(p.losses),
    ties: Number(p.ties),
    currentStreak: Number(p.currentStreak),
  };
}

export async function getRoomCreatedAt(roomId: string): Promise<number | null> {
  const data = await indexer.request<{ Room: { createdAt: string }[] }>(
    ROOM_CREATED_AT_QUERY,
    { id: roomId }
  );
  const first = data.Room[0];
  return first ? Number(first.createdAt) : null;
}

const ROOMS_CREATED_AT_BATCH_QUERY = gql`
  query RoomsCreatedAtBatch($ids: [String!]!) {
    Room(where: { id: { _in: $ids } }) {
      id
      createdAt
    }
  }
`;

export async function getRoomsCreatedAt(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const data = await indexer.request<{ Room: { id: string; createdAt: string }[] }>(
    ROOMS_CREATED_AT_BATCH_QUERY,
    { ids }
  );
  return Object.fromEntries(data.Room.map((r) => [r.id, Number(r.createdAt)]));
}

export type ActiveIndexerRoom = {
  id: string;
  state: string;
  token: string;
  stake: string;
  createdAt: string;
};

const ACTIVE_ROOMS_BY_PLAYER_QUERY = gql`
  query ActiveRoomsByPlayer($address: String!) {
    Room(
      where: {
        _and: [
          { playerA: { _eq: $address } }
          { state: { _in: ["OPEN", "MATCHED"] } }
        ]
      }
      order_by: { createdAt: desc }
      limit: 50
    ) {
      id
      state
      token
      stake
      createdAt
    }
  }
`;

export async function getActiveRoomsByPlayer(address: string): Promise<ActiveIndexerRoom[]> {
  const data = await indexer.request<{ Room: ActiveIndexerRoom[] }>(
    ACTIVE_ROOMS_BY_PLAYER_QUERY,
    { address: address.toLowerCase() }
  );
  return data.Room;
}

export type H2HSummary = { myWins: number; theirWins: number; ties: number };

export async function getHeadToHead(
  myAddress: string,
  opponentAddress: string
): Promise<H2HSummary | null> {
  const a = myAddress.toLowerCase();
  const b = opponentAddress.toLowerCase();
  const data = await indexer.request<{
    Room: { winner: string | null; state: string }[];
  }>(HEAD_TO_HEAD_QUERY, { a, b });

  if (data.Room.length === 0) return null;

  let myWins = 0, theirWins = 0, ties = 0;
  for (const room of data.Room) {
    if (room.state === "TIED") ties++;
    else if (room.winner?.toLowerCase() === a) myWins++;
    else theirWins++;
  }
  return { myWins, theirWins, ties };
}

// ─── Contract Stats ───────────────────────────────────────────────────────────

export type RecentGame = {
  id: string;
  state: string;
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

const CONTRACT_STATS_QUERY = gql`
  query ContractStats {
    openRooms: Room(where: { state: { _eq: "OPEN" } }, limit: 500) { id }
    matchedRooms: Room(where: { state: { _eq: "MATCHED" } }, limit: 500) { id }
    resolvedRooms: Room(where: { state: { _eq: "RESOLVED" } }, limit: 9999) { stake token }
    tiedRooms: Room(where: { state: { _eq: "TIED" } }, limit: 9999) { stake token }
    expiredRooms: Room(where: { state: { _eq: "EXPIRED" } }, limit: 500) { id }
    recentGames: Room(
      where: { state: { _in: ["RESOLVED", "TIED"] } }
      order_by: { resolvedAt: desc }
      limit: 15
    ) {
      id
      state
      winner
      playerA
      playerB
      stake
      token
      resolvedAt
    }
  }
`;

export async function getContractStats(): Promise<ContractStats> {
  const data = await indexer.request<{
    openRooms: { id: string }[];
    matchedRooms: { id: string }[];
    resolvedRooms: { stake: string; token: string }[];
    tiedRooms: { stake: string; token: string }[];
    expiredRooms: { id: string }[];
    recentGames: RecentGame[];
  }>(CONTRACT_STATS_QUERY);

  const volumeByToken: Record<string, bigint> = {};
  for (const room of [...data.resolvedRooms, ...data.tiedRooms]) {
    const key = room.token.toLowerCase();
    volumeByToken[key] = (volumeByToken[key] ?? 0n) + BigInt(room.stake);
  }

  return {
    open: data.openRooms.length,
    matched: data.matchedRooms.length,
    resolved: data.resolvedRooms.length,
    tied: data.tiedRooms.length,
    expired: data.expiredRooms.length,
    totalFinished: data.resolvedRooms.length + data.tiedRooms.length,
    volumeByToken,
    recentGames: data.recentGames,
  };
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
