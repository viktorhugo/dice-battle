import { GoldskyGameRepository } from "./goldsky";
import type { IGameRepository } from "./interface";

const ENDPOINT =
  process.env.NEXT_PUBLIC_GOLDSKY_URL ||
  "http://localhost:8000/subgraphs/name/dice-battle";

let _instance: IGameRepository | null = null;

export function getRepository(): IGameRepository {
  if (!_instance) {
    _instance = new GoldskyGameRepository(ENDPOINT);
  }
  return _instance;
}

// ─── Convenience wrappers — same signatures as the old indexer.ts ─────────────
// Consumers call these directly without going through getRepository()

export const getOpenRooms           = (...a: Parameters<IGameRepository["getOpenRooms"]>)           => getRepository().getOpenRooms(...a);
export const getOpenRoomsPage       = (...a: Parameters<IGameRepository["getOpenRoomsPage"]>)       => getRepository().getOpenRoomsPage(...a);
export const getRoomById            = (...a: Parameters<IGameRepository["getRoomById"]>)            => getRepository().getRoomById(...a);
export const getRoomCreatedAt       = (...a: Parameters<IGameRepository["getRoomCreatedAt"]>)       => getRepository().getRoomCreatedAt(...a);
export const getRoomsCreatedAt      = (...a: Parameters<IGameRepository["getRoomsCreatedAt"]>)      => getRepository().getRoomsCreatedAt(...a);
export const getActiveRoomsByPlayer = (...a: Parameters<IGameRepository["getActiveRoomsByPlayer"]>) => getRepository().getActiveRoomsByPlayer(...a);
export const getMatchedRoomsAsGuest = (...a: Parameters<IGameRepository["getMatchedRoomsAsGuest"]>) => getRepository().getMatchedRoomsAsGuest(...a);
export const getPlayerProfile       = (...a: Parameters<IGameRepository["getPlayerProfile"]>)       => getRepository().getPlayerProfile(...a);
export const getPlayerMiniStats     = (...a: Parameters<IGameRepository["getPlayerMiniStats"]>)     => getRepository().getPlayerMiniStats(...a);
export const getLeaderboardAllTime  = (...a: Parameters<IGameRepository["getLeaderboardAllTime"]>)  => getRepository().getLeaderboardAllTime(...a);
export const getLeaderboardPeriod   = (...a: Parameters<IGameRepository["getLeaderboardPeriod"]>)   => getRepository().getLeaderboardPeriod(...a);
export const getLiveStats           = (...a: Parameters<IGameRepository["getLiveStats"]>)           => getRepository().getLiveStats(...a);
export const getHeadToHead          = (...a: Parameters<IGameRepository["getHeadToHead"]>)          => getRepository().getHeadToHead(...a);
export const getContractStats       = (...a: Parameters<IGameRepository["getContractStats"]>)       => getRepository().getContractStats(...a);

export type {
  Room,
  Player,
  LeaderboardEntry,
  LiveStats,
  PlayerMiniStats,
  H2HSummary,
  ContractStats,
  RecentGame,
  RoomState,
  SortKey,
  LeaderboardTab,
} from "./types";

export type { IGameRepository } from "./interface";
