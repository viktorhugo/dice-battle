import { GraphQLClient, gql } from "graphql-request";
import type { IGameRepository } from "./interface";
import type {
  Room,
  Player,
  LeaderboardEntry,
  LiveStats,
  PlayerMiniStats,
  H2HSummary,
  ContractStats,
  RecentGame,
} from "./types";

// ─── Internal GQL types (never exported) ─────────────────────────────────────

type GqlRoom = {
  id: string;
  state: string;
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

type GqlPlayer = {
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

type GqlGlobalStats = {
  open: string;
  matched: string;
  resolved: string;
  tied: string;
  expired: string;
  totalFinished: string;
};

type GqlTokenVolume = {
  id: string;
  volume: string;
};

// ─── Queries ─────────────────────────────────────────────────────────────────

const OPEN_ROOMS_QUERY = gql`
  query OpenRooms($first: Int!) {
    rooms(
      first: $first
      orderBy: createdAt
      orderDirection: desc
      where: { state: "OPEN" }
    ) {
      id playerA token stake createdAt
    }
  }
`;

const OPEN_ROOMS_PAGE_QUERY = gql`
  query OpenRoomsPage($first: Int!, $skip: Int!) {
    rooms(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
      where: { state: "OPEN" }
    ) {
      id playerA token stake createdAt
    }
    allOpen: rooms(first: 500, where: { state: "OPEN" }) { id }
  }
`;

const OPEN_ROOMS_PAGE_FILTERED_QUERY = gql`
  query OpenRoomsPageFiltered($first: Int!, $skip: Int!, $excludeAddress: String!) {
    rooms(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
      where: { state: "OPEN", playerA_not: $excludeAddress }
    ) {
      id playerA token stake createdAt
    }
    allOpen: rooms(first: 500, where: { state: "OPEN", playerA_not: $excludeAddress }) { id }
  }
`;

const ROOM_BY_ID_QUERY = gql`
  query RoomById($id: ID!) {
    room(id: $id) {
      id state playerA playerB token stake winner
      rollA1 rollA2 rollB1 rollB2 createdAt resolvedAt
    }
  }
`;

const ROOM_CREATED_AT_QUERY = gql`
  query RoomCreatedAt($id: ID!) {
    room(id: $id) { createdAt }
  }
`;

const ROOMS_CREATED_AT_BATCH_QUERY = gql`
  query RoomsCreatedAtBatch($ids: [ID!]!) {
    rooms(where: { id_in: $ids }) { id createdAt }
  }
`;

const ACTIVE_ROOMS_BY_PLAYER_QUERY = gql`
  query ActiveRoomsByPlayer($address: String!) {
    rooms(
      first: 50
      orderBy: createdAt
      orderDirection: desc
      where: { playerA: $address, state_in: ["OPEN", "MATCHED"] }
    ) {
      id state token stake createdAt
    }
  }
`;

const GUEST_MATCHED_ROOMS_QUERY = gql`
  query GuestMatchedRooms($address: String!) {
    rooms(
      first: 50
      orderBy: createdAt
      orderDirection: desc
      where: { playerB: $address, state: "MATCHED" }
    ) {
      id state token stake createdAt
    }
  }
`;

const PLAYER_PROFILE_QUERY = gql`
  query PlayerProfile($id: ID!, $address: String!) {
    player(id: $id) {
      totalGames wins losses ties totalVolume
      totalWon totalLost lastGameAt currentStreak longestStreak
    }
    rooms(
      first: 10
      orderBy: resolvedAt
      orderDirection: desc
      where: {
        or: [{ playerA: $address }, { playerB: $address }]
        state_in: ["RESOLVED", "TIED", "EXPIRED"]
      }
    ) {
      id state playerA playerB winner stake token
      rollA1 rollA2 rollB1 rollB2 createdAt resolvedAt
    }
  }
`;

const LIVE_STATS_QUERY = gql`
  query LiveStats($since: BigInt!) {
    globalStats(id: "global") { open totalFinished }
    gamesToday: rooms(
      first: 1000
      where: { resolvedAt_gte: $since, state_in: ["RESOLVED", "TIED"] }
    ) { id }
  }
`;

const LIVE_STATS_FILTERED_QUERY = gql`
  query LiveStatsFiltered($since: BigInt!, $excludeAddress: String!) {
    globalStats(id: "global") { totalFinished }
    openRooms: rooms(first: 500, where: { state: "OPEN", playerA_not: $excludeAddress }) { id }
    gamesToday: rooms(
      first: 1000
      where: { resolvedAt_gte: $since, state_in: ["RESOLVED", "TIED"] }
    ) { id }
    myRoomsAsHost: rooms(
      first: 50
      where: { playerA: $excludeAddress, state_in: ["OPEN", "MATCHED"] }
    ) { id }
    myRoomsAsGuest: rooms(
      first: 50
      where: { playerB: $excludeAddress, state: "MATCHED" }
    ) { id }
  }
`;

const PLAYER_MINI_STATS_QUERY = gql`
  query PlayerMiniStats($id: ID!) {
    player(id: $id) { wins losses ties currentStreak }
  }
`;

const LEADERBOARD_QUERY = gql`
  query Leaderboard($first: Int!) {
    players(first: $first, orderBy: wins, orderDirection: desc) {
      id totalGames wins losses ties totalVolume
    }
  }
`;

const LEADERBOARD_PERIOD_QUERY = gql`
  query LeaderboardPeriod($since: BigInt!, $skip: Int!) {
    rooms(
      first: 1000
      skip: $skip
      orderBy: resolvedAt
      orderDirection: asc
      where: { resolvedAt_gte: $since, state_in: ["RESOLVED", "TIED"] }
    ) {
      winner playerA playerB state stake
    }
  }
`;

const HEAD_TO_HEAD_QUERY = gql`
  query HeadToHead($a: String!, $b: String!) {
    rooms(
      first: 20
      orderBy: resolvedAt
      orderDirection: desc
      where: {
        or: [
          { playerA: $a, playerB: $b }
          { playerA: $b, playerB: $a }
        ]
        state_in: ["RESOLVED", "TIED"]
      }
    ) {
      winner state
    }
  }
`;

const CONTRACT_STATS_QUERY = gql`
  query ContractStats {
    globalStats(id: "global") {
      open matched resolved tied expired totalFinished
    }
    tokenVolumes(first: 20) {
      id volume
    }
    recentGames: rooms(
      first: 15
      orderBy: resolvedAt
      orderDirection: desc
      where: { state_in: ["RESOLVED", "TIED"] }
    ) {
      id state winner playerA playerB stake token resolvedAt
    }
  }
`;

// ─── Implementation ───────────────────────────────────────────────────────────

export class GoldskyGameRepository implements IGameRepository {
  private readonly client: GraphQLClient;

  constructor(endpoint: string) {
    this.client = new GraphQLClient(endpoint);
  }

  async getOpenRooms(limit = 20): Promise<Room[]> {
    const data = await this.client.request<{ rooms: GqlRoom[] }>(
      OPEN_ROOMS_QUERY,
      { first: limit }
    );
    return data.rooms as Room[];
  }

  async getOpenRoomsPage(
    page: number,
    pageSize = 10,
    excludeAddress?: string
  ): Promise<{ rooms: Room[]; total: number }> {
    const skip = (page - 1) * pageSize;
    if (excludeAddress) {
      const data = await this.client.request<{
        rooms: GqlRoom[];
        allOpen: { id: string }[];
      }>(OPEN_ROOMS_PAGE_FILTERED_QUERY, {
        first: pageSize,
        skip,
        excludeAddress: excludeAddress.toLowerCase(),
      });
      return { rooms: data.rooms as Room[], total: data.allOpen.length };
    }
    const data = await this.client.request<{
      rooms: GqlRoom[];
      allOpen: { id: string }[];
    }>(OPEN_ROOMS_PAGE_QUERY, { first: pageSize, skip });
    return { rooms: data.rooms as Room[], total: data.allOpen.length };
  }

  async getRoomById(roomId: string): Promise<Room | null> {
    const data = await this.client.request<{ room: GqlRoom | null }>(
      ROOM_BY_ID_QUERY,
      { id: roomId }
    );
    return (data.room as Room | null) ?? null;
  }

  async getRoomCreatedAt(roomId: string): Promise<number | null> {
    const data = await this.client.request<{ room: { createdAt: string } | null }>(
      ROOM_CREATED_AT_QUERY,
      { id: roomId }
    );
    return data.room ? Number(data.room.createdAt) : null;
  }

  async getRoomsCreatedAt(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {};
    const data = await this.client.request<{ rooms: { id: string; createdAt: string }[] }>(
      ROOMS_CREATED_AT_BATCH_QUERY,
      { ids }
    );
    return Object.fromEntries(data.rooms.map((r) => [r.id, Number(r.createdAt)]));
  }

  async getActiveRoomsByPlayer(address: string): Promise<Room[]> {
    const data = await this.client.request<{ rooms: GqlRoom[] }>(
      ACTIVE_ROOMS_BY_PLAYER_QUERY,
      { address: address.toLowerCase() }
    );
    return data.rooms as Room[];
  }

  async getMatchedRoomsAsGuest(address: string): Promise<Room[]> {
    const data = await this.client.request<{ rooms: GqlRoom[] }>(
      GUEST_MATCHED_ROOMS_QUERY,
      { address: address.toLowerCase() }
    );
    return data.rooms as Room[];
  }

  async getPlayerProfile(address: string): Promise<{ player: Player | null; rooms: Room[] }> {
    const id = address.toLowerCase();
    const data = await this.client.request<{
      player: GqlPlayer | null;
      rooms: GqlRoom[];
    }>(PLAYER_PROFILE_QUERY, { id, address: id });
    return {
      player: (data.player as Player | null) ?? null,
      rooms: data.rooms as Room[],
    };
  }

  async getPlayerMiniStats(address: string): Promise<PlayerMiniStats | null> {
    const id = address.toLowerCase();
    const data = await this.client.request<{
      player: { wins: string; losses: string; ties: string; currentStreak: string } | null;
    }>(PLAYER_MINI_STATS_QUERY, { id });
    if (!data.player) return null;
    const p = data.player;
    return {
      wins: Number(p.wins),
      losses: Number(p.losses),
      ties: Number(p.ties),
      currentStreak: Number(p.currentStreak),
    };
  }

  async getLeaderboardAllTime(limit = 50): Promise<LeaderboardEntry[]> {
    const data = await this.client.request<{
      players: {
        id: string;
        totalGames: string;
        wins: string;
        losses: string;
        ties: string;
        totalVolume: string;
      }[];
    }>(LEADERBOARD_QUERY, { first: limit });
    return data.players.map((p) => {
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

  async getLeaderboardPeriod(sinceSeconds: number): Promise<LeaderboardEntry[]> {
    type PeriodRoom = {
      winner: string | null;
      playerA: string;
      playerB: string | null;
      state: string;
      stake: string;
    };
    const PAGE_SIZE = 1000;
    const allRooms: PeriodRoom[] = [];
    let skip = 0;

    while (true) {
      const data = await this.client.request<{ rooms: PeriodRoom[] }>(
        LEADERBOARD_PERIOD_QUERY,
        { since: sinceSeconds.toString(), skip }
      );
      allRooms.push(...data.rooms);
      if (data.rooms.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
    }

    const map = new Map<string, { wins: number; losses: number; ties: number; volume: bigint }>();
    for (const room of allRooms) {
      const participants = [room.playerA, room.playerB].filter(Boolean) as string[];
      for (const addr of participants) {
        if (!map.has(addr)) map.set(addr, { wins: 0, losses: 0, ties: 0, volume: 0n });
        const p = map.get(addr)!;
        p.volume += BigInt(room.stake);
        if (room.state === "TIED") p.ties++;
        else if (room.winner === addr) p.wins++;
        else p.losses++;
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

  async getLiveStats(excludeAddress?: string): Promise<LiveStats> {
    const since = (Math.floor(Date.now() / 1000) - 86_400).toString();
    if (excludeAddress) {
      const addr = excludeAddress.toLowerCase();
      const data = await this.client.request<{
        globalStats: { totalFinished: string } | null;
        openRooms: { id: string }[];
        gamesToday: { id: string }[];
        myRoomsAsHost: { id: string }[];
        myRoomsAsGuest: { id: string }[];
      }>(LIVE_STATS_FILTERED_QUERY, { since, excludeAddress: addr });
      return {
        openRooms: data.openRooms.length,
        gamesToday: data.gamesToday.length,
        totalGames: Number(data.globalStats?.totalFinished ?? 0),
        myActiveRooms: data.myRoomsAsHost.length + data.myRoomsAsGuest.length,
      };
    }
    const data = await this.client.request<{
      globalStats: { open: string; totalFinished: string } | null;
      gamesToday: { id: string }[];
    }>(LIVE_STATS_QUERY, { since });
    return {
      openRooms: Number(data.globalStats?.open ?? 0),
      gamesToday: data.gamesToday.length,
      totalGames: Number(data.globalStats?.totalFinished ?? 0),
    };
  }

  async getHeadToHead(myAddress: string, opponentAddress: string): Promise<H2HSummary | null> {
    const a = myAddress.toLowerCase();
    const b = opponentAddress.toLowerCase();
    const data = await this.client.request<{
      rooms: { winner: string | null; state: string }[];
    }>(HEAD_TO_HEAD_QUERY, { a, b });
    if (data.rooms.length === 0) return null;
    let myWins = 0, theirWins = 0, ties = 0;
    for (const room of data.rooms) {
      if (room.state === "TIED") ties++;
      else if (room.winner?.toLowerCase() === a) myWins++;
      else theirWins++;
    }
    return { myWins, theirWins, ties };
  }

  async getContractStats(): Promise<ContractStats> {
    const data = await this.client.request<{
      globalStats: GqlGlobalStats | null;
      tokenVolumes: GqlTokenVolume[];
      recentGames: RecentGame[];
    }>(CONTRACT_STATS_QUERY);

    const gs = data.globalStats;
    const volumeByToken: Record<string, bigint> = {};
    for (const tv of data.tokenVolumes) {
      volumeByToken[tv.id.toLowerCase()] = BigInt(tv.volume);
    }

    return {
      open: Number(gs?.open ?? 0),
      matched: Number(gs?.matched ?? 0),
      resolved: Number(gs?.resolved ?? 0),
      tied: Number(gs?.tied ?? 0),
      expired: Number(gs?.expired ?? 0),
      totalFinished: Number(gs?.totalFinished ?? 0),
      volumeByToken,
      recentGames: data.recentGames,
    };
  }
}
