import { GraphQLClient, gql } from "graphql-request";

const ENDPOINT =
  process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:8080/v1/graphql";

export const indexer = new GraphQLClient(ENDPOINT);

export type IndexerRoom = {
  id: string;
  playerA: string;
  token: string;
  stake: string;
  createdAt: string;
};

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

export async function getOpenRooms(limit = 20): Promise<IndexerRoom[]> {
  const data = await indexer.request<{ Room: IndexerRoom[] }>(
    OPEN_ROOMS_QUERY,
    { limit }
  );
  return data.Room;
}
