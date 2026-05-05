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

export type IndexerProfileRoom = {
  id: string;
  state: string;
  playerA: string;
  playerB: string | null;
  winner: string | null;
  stake: string;
  token: string;
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
